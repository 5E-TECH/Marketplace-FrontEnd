import { http } from 'msw';
import { db } from '../db';
import { allMockAccounts, createMockStaff, findMockUser, revokeMockSessions, type MockAccount } from '../fixtures/users';
import { API, fail, ok } from '../utils';
import { audit, bumpAuth, guard, IN_CALL, invalid, liveOf, PHONE, randomPassword, softphoneView, targetOf, view } from './staff';

/**
 * Nazoratchi jamoasi (FE-15 «Jamoa», nazoratchi-jamoa; 15-qaror — asosiy variant): nazoratchi o'z jamoasini yuritadi —
 * operator qo'shadi, tahrirlaydi, nofaol qiladi va faollashtiradi; bloklash va blokdan chiqarishni admin'dan so'raydi.
 * Hammasi taklif: docs/api-taklif/fe-15-admin-foydalanuvchilar.md §14.
 */
const SUPERVISOR = ['SUPERVISOR'];

const teamOf = (actor: MockAccount) => db.teams.find((team) => team.supervisorId === actor.id) ?? null;
const membersOf = (teamId: string) => allMockAccounts().filter((account) => account.role === 'OPERATOR_LEAD' && !account.isDeleted && account.staff?.teamId === teamId);

function memberView(account: MockAccount) {
  return { ...view(account), softphone: softphoneView(account), inactive: account.staff?.inactive ?? null, request: account.staff?.request ?? null };
}

/** So'rov egasi — shu nazoratchi jamoasidagi operator; aks holda 404 (boshqa jamoa ko'rinmaydi). */
function memberOf(actor: MockAccount, id: unknown): MockAccount | null {
  const team = teamOf(actor);
  const target = targetOf(id);
  return team && target?.role === 'OPERATOR_LEAD' && target.staff?.teamId === team.id ? target : null;
}

const notFound = () => fail(404, 'NOT_FOUND', 'Operator jamoangizda topilmadi');
const name = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const supervisorTeamHandlers = [
  http.get(`${API}/supervisor/team`, ({ request, cookies }) => {
    const { actor, denied } = guard(request, cookies, SUPERVISOR);
    if (denied) return denied;
    const team = teamOf(actor);
    const operators = team ? membersOf(team.id).map(memberView) : [];
    return ok({ team: team ? { id: team.id, supervisorId: actor.id, supervisorName: actor.name } : null, operators });
  }),

  // Operator qo'shish: o'z jamoasiga; band telefon — 409 va kimniki.
  http.post(`${API}/supervisor/team/operators`, async ({ request, cookies }) => {
    const { actor, denied } = guard(request, cookies, SUPERVISOR);
    if (denied) return denied;
    const team = teamOf(actor);
    if (!team) return fail(409, 'CONFLICT', 'Sizda jamoa yo‘q — admin jamoa yaratadi');
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const firstName = name(body.firstName);
    const lastName = name(body.lastName);
    if (!firstName) return invalid('firstName', 'Ismni kiriting');
    if (!lastName) return invalid('lastName', 'Familiyani kiriting');
    if (typeof body.phone !== 'string' || !PHONE.test(body.phone)) return invalid('phone', 'phone +998XXXXXXXXX formatida bo\'lishi kerak');
    const existing = findMockUser(body.phone);
    if (existing) return fail(409, 'CONFLICT', 'Bu telefon allaqachon ro‘yxatdan o‘tgan', undefined, { existingUser: { id: existing.id, name: existing.name } });
    const account = createMockStaff({
      phone: body.phone, role: 'OPERATOR_LEAD', firstName, lastName, createdBy: { id: actor.id, name: actor.name }, teamId: team.id, smsSent: true,
      workspace: body.workspace === 'SIP' ? 'SIP' : 'BROWSER',
    });
    audit(actor, 'supervisor.operator.create', account, { before: null, after: { name: account.name, phone: account.phone, teamId: team.id } });
    return ok({ ...memberView(account), temporaryPassword: randomPassword(), smsSent: true }, 201);
  }),

  // Tahrirlash: ism, familiya, telefon, ish joyi (suhbatda — suhbat tugagach).
  http.patch(`${API}/supervisor/team/operators/:id`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies, SUPERVISOR);
    if (denied) return denied;
    const target = memberOf(actor, params.id);
    if (!target?.staff) return notFound();
    if (target.isBlocked) return fail(409, 'CONFLICT', 'Bloklangan operatorni tahrirlab bo‘lmaydi');
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const firstName = name(body.firstName);
    const lastName = name(body.lastName);
    if (!firstName) return invalid('firstName', 'Ismni kiriting');
    if (!lastName) return invalid('lastName', 'Familiyani kiriting');
    if (typeof body.phone !== 'string' || !PHONE.test(body.phone)) return invalid('phone', 'phone +998XXXXXXXXX formatida bo\'lishi kerak');
    const owner = findMockUser(body.phone);
    if (owner && owner.id !== target.id) return fail(409, 'CONFLICT', 'Bu telefon allaqachon ro‘yxatdan o‘tgan', undefined, { existingUser: { id: owner.id, name: owner.name } });
    const before = { name: target.name, phone: target.phone, workspace: target.staff.workspace };
    target.name = `${firstName} ${lastName}`;
    target.phone = body.phone;
    target.staff.firstName = firstName;
    target.staff.lastName = lastName;
    if (body.workspace === 'BROWSER' || body.workspace === 'SIP') {
      const busy = IN_CALL.includes(liveOf(target.id)?.activity?.kind ?? '');
      if (busy && body.workspace !== target.staff.workspace) target.staff.pendingWorkspace = body.workspace;
      else {
        target.staff.workspace = body.workspace;
        target.staff.pendingWorkspace = null;
      }
    }
    audit(actor, 'supervisor.operator.update', target, { before, after: { name: target.name, phone: target.phone, workspace: body.workspace } });
    return ok(memberView(target));
  }),

  // Nofaol qilish: suhbat paytida — 409; sessiya tugaydi, softfon to'xtaydi, navbatdan lid olmaydi.
  http.post(`${API}/supervisor/team/operators/:id/deactivate`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies, SUPERVISOR);
    if (denied) return denied;
    const target = memberOf(actor, params.id);
    if (!target?.staff) return notFound();
    if (target.isBlocked) return fail(409, 'CONFLICT', 'Operator bloklangan');
    if (IN_CALL.includes(liveOf(target.id)?.activity?.kind ?? '')) return fail(409, 'OPERATOR_IN_CALL', 'Operator hozir suhbatda — suhbat tugagach nofaol qiling');
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = name(body.reason);
    if (!reason) return invalid('reason', 'Sababni yozing');
    target.isActive = false;
    target.staff.inactive = { at: new Date().toISOString(), by: actor.name, reason };
    bumpAuth(target);
    revokeMockSessions(target);
    audit(actor, 'supervisor.operator.deactivate', target, { reason });
    return ok(memberView(target));
  }),

  http.post(`${API}/supervisor/team/operators/:id/activate`, ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies, SUPERVISOR);
    if (denied) return denied;
    const target = memberOf(actor, params.id);
    if (!target?.staff) return notFound();
    target.isActive = true;
    target.staff.inactive = null;
    audit(actor, 'supervisor.operator.activate', target);
    return ok(memberView(target));
  }),

  // Bloklash yoki blokdan chiqarishni so'rash: admin hal qiladi; bloklash so'rovida «javobgacha nofaol qilish».
  ...(['block', 'unblock'] as const).map((kind) => http.post(`${API}/supervisor/team/operators/:id/${kind}-request`, async ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies, SUPERVISOR);
    if (denied) return denied;
    const target = memberOf(actor, params.id);
    if (!target?.staff) return notFound();
    if (kind === 'block' && target.isBlocked) return fail(409, 'CONFLICT', 'Operator allaqachon bloklangan');
    if (kind === 'unblock' && !target.isBlocked) return fail(409, 'CONFLICT', 'Operator bloklanmagan');
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown; deactivate?: unknown };
    const reason = name(body.reason);
    if (!reason) return invalid('reason', 'Sababni yozing — admin usiz qaror qilmaydi');
    const at = new Date().toISOString();
    target.staff.request = { kind: kind === 'block' ? 'BLOCK' : 'UNBLOCK', at, by: actor.name, reason };
    if (kind === 'block' && body.deactivate === true) {
      target.isActive = false;
      target.staff.inactive = { at, by: actor.name, reason };
      bumpAuth(target);
      revokeMockSessions(target);
    }
    audit(actor, `supervisor.${kind}.request`, target, { reason, deactivate: body.deactivate === true });
    return ok(memberView(target), 201);
  })),

  http.post(`${API}/supervisor/team/operators/:id/welcome-sms`, ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies, SUPERVISOR);
    if (denied) return denied;
    const target = memberOf(actor, params.id);
    if (!target?.staff) return notFound();
    if (target.staff.lastLoginAt) return fail(409, 'CONFLICT', 'Operator allaqachon kirgan');
    target.staff.temporaryPassword = { issuedAt: target.staff.temporaryPassword?.issuedAt ?? new Date().toISOString(), smsSentAt: new Date().toISOString() };
    return ok({ smsSent: true });
  }),

  // O'zgarishlar tarixi: shu operator ustidagi audit yozuvlari (yangisi tepada).
  http.get(`${API}/supervisor/team/operators/:id/history`, ({ request, cookies, params }) => {
    const { actor, denied } = guard(request, cookies, SUPERVISOR);
    if (denied) return denied;
    const target = memberOf(actor, params.id);
    if (!target) return notFound();
    return ok({ items: db.userAudit.filter((entry) => entry.entityId === target.id).slice(0, 20) });
  }),
];
