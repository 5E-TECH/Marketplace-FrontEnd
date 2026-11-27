import { describe, expect, it } from 'vitest';
import type { AuditEntry, UserAccount } from '../../../features/staff/model/staffTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { staffTranslations } from '../../../shared/i18n/staffTranslations';
import { countText, peopleSummary, roleGrantedAt, roleStats } from './roleStats';

/** FE-15 «Rollar va ruxsatlar»: har rol bo'yicha odamlar soni va qisqa ro'yxat (admin-rollar «Foydalanuvchilar»). */
const t = (key: TranslationKey, params: Record<string, string | number> = {}) => Object.entries(params)
  .reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), (staffTranslations.uz as Record<string, string>)[key] ?? key);

const user = (patch: Partial<UserAccount>): UserAccount => ({
  id: 'U-1', code: 'U-1', name: 'Ali Valiyev', firstName: 'Ali', lastName: 'Valiyev', phone: '+998901112233', role: 'OPERATOR_LEAD', roleRaw: 'OPERATOR_LEAD',
  isActive: true, isBlocked: false, totpEnabledAt: null, createdAt: '2026-11-01T08:00:00.000Z', ...patch,
});

describe('rol statistikasi', () => {
  const staff = [
    user({ id: 'U-6', name: 'Ozoda Botirova', role: 'FINANCE' }),
    user({ id: 'U-5', name: 'Gulnora Saidova', role: 'FINANCE' }),
    user({ id: 'U-7', name: 'Nodira Karimova', role: 'ADMIN' }),
    user({ id: 'U-1', name: 'Ali Valiyev' }),
    user({ id: 'U-2', name: 'Lola Azimova' }),
    user({ id: 'U-3', name: 'Kamron Davletov', isBlocked: true }),
    user({ id: 'U-9', name: 'Laylo Nazarova', role: null }),
  ];
  const stats = roleStats(staff, { AFFILIATE: 41, WHOLESALER: 1 });

  it('ikkitagacha — ismlar (alifbo, «siz» belgisi); ko‘p bo‘lsa — faol va bloklanganlar', () => {
    expect(peopleSummary('FINANCE', stats.FINANCE, 'U-7', t)).toBe('Gulnora S., Ozoda B.');
    expect(peopleSummary('ADMIN', stats.ADMIN, 'U-7', t)).toBe('Nodira K. (siz)');
    expect(peopleSummary('OPERATOR_LEAD', stats.OPERATOR_LEAD, 'U-7', t)).toBe('2 faol · 1 bloklangan');
    expect(peopleSummary('AFFILIATE', stats.AFFILIATE, 'U-7', t)).toBe('o‘zi ro‘yxatdan o‘tadi');
    expect(countText('AFFILIATE', stats.AFFILIATE)).toBe('41');
  });

  it('superadmin backendda yashirin bo‘lsa — «—» va «ro‘yxatda ko‘rinmaydi»; ro‘yxat yuklanmagan — son noma’lum', () => {
    expect(countText('SUPERADMIN', stats.SUPERADMIN)).toBe('—');
    expect(peopleSummary('SUPERADMIN', stats.SUPERADMIN, 'U-7', t)).toBe('ro‘yxatda ko‘rinmaydi');
    expect(peopleSummary('WAREHOUSE', stats.WAREHOUSE, 'U-7', t)).toBe('hali yo‘q');
    const pending = roleStats(undefined, {});
    expect(countText('ADMIN', pending.ADMIN)).toBe('—');
    expect(countText('WHOLESALER', pending.WHOLESALER)).toBe('—');
  });

  it('rol qachon berilgan — auditdagi rol yozuvi (`after.role`)', () => {
    const entry = (action: string, role: string, createdAt: string): AuditEntry => ({
      id: createdAt, createdAt, actorId: 'U-8', actorName: 'Akmal Sobirov', action, entityType: 'User', entityId: 'U-4', meta: { after: { role } },
    });
    const entries = [entry('user.block', 'SUPERVISOR', '2026-11-25T08:00:00.000Z'), entry('user.role.update', 'SUPERVISOR', '2026-11-22T08:00:00.000Z'), entry('admin.team.create', 'OPERATOR_LEAD', '2026-10-01T08:00:00.000Z')];
    expect(roleGrantedAt(entries, 'SUPERVISOR')).toBe('2026-11-22T08:00:00.000Z');
    expect(roleGrantedAt(entries, 'OPERATOR_LEAD')).toBe('2026-10-01T08:00:00.000Z');
    expect(roleGrantedAt(entries, 'ADMIN')).toBeNull();
  });
});
