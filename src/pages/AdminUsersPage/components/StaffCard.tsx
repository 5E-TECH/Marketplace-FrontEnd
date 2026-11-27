import { App } from 'antd';
import axios from 'axios';
import { Ban, ChevronRight, CircleCheck, CircleX, Info, KeyRound, Lock, LogOut, RotateCcw, ShieldCheck, UserCog, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { UserRole } from '../../../features/auth/model/authTypes';
import { ROLE_LABEL_KEYS } from '../../../features/auth/lib/roleLabels';
import { useResendWelcomeSmsMutation, useSoftphonesQuery, useUserAccountQuery, useUserActionsQuery, useUserLoginsQuery, useUserSessionsQuery } from '../../../features/staff/api/staffQueries';
import { auditText } from '../../../features/staff/lib/auditText';
import { roleMenuKeys } from '../../../features/staff/lib/roleMenu';
import { dayText, displayName, lastLoginText, momentText } from '../../../features/staff/lib/staffFormat';
import { LOGIN_METHOD_KEYS, roleInfo } from '../../../features/staff/model/roleCatalog';
import { accountStatus, staffPermissions, twoFactorState, usesTwoFactor } from '../../../features/staff/model/staffRules';
import type { UserAccount } from '../../../features/staff/model/staffTypes';
import { SessionRow } from '../../../features/staff/ui/SessionRow';
import { AccountStatusBadge, Avatar } from '../../../features/staff/ui/StaffBadges';
import type { StaffDialogState } from '../../../features/staff/ui/StaffDialogs';
import { useUnblockUser } from '../../../features/staff/ui/useUnblockUser';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { formatUzPhone } from '../../../shared/lib/phone';
import { tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { denialKey } from '../model/staffLabels';
import styles from './StaffCard.module.css';

export type CardVariant = 'panel' | 'drawer' | 'page';

interface StaffCardProps {
  userId: string;
  /** Ro'yxatdagi qator — kartani darhol chizish uchun. */
  initial?: UserAccount;
  viewer: { id: string; role: UserRole };
  variant: CardVariant;
  onClose?: () => void;
  onDialog: (state: StaffDialogState) => void;
}

/**
 * Xodim kartasi (admin-foydalanuvchi-karta + .planshet/.mobil/.holatlar): desktopda ro'yxat yonida 440 px panel,
 * planshetda o'ngdan drawer, telefonda ichki sahifa (bo'limlar alohida kartalarda). Holatlar: K2 hali kirmagan,
 * K3 bloklangan (yagona amal — «Blokdan chiqarish»), K4 o'zi, K5 superadmin (admin ko'rinishi), K6 superadmin
 * «2FA ni tiklash».
 */
export function StaffCard({ userId, initial, viewer, variant, onClose, onDialog }: StaffCardProps) {
  const { t } = useTranslation();
  const query = useUserAccountQuery(userId, initial);
  const user = query.data;

  if (!user) {
    const missing = axios.isAxiosError(query.error) && [404, 409].includes(query.error.response?.status ?? 0);
    return (
      <aside className={styles.card} data-variant={variant} aria-busy={query.isPending || undefined} data-testid="staff-card">
        {onClose ? <div className={styles.closeRow}><CloseButton onClose={onClose} /></div> : null}
        <div className={styles.stateBox}>
          {query.isPending ? <p className={styles.muted} role="status">{t('staff.card.loading')}</p>
            : missing ? (
              <>
                <p className={styles.stateTitle}>{t('staff.card.notFound')}</p>
                <p className={styles.muted}>{t('staff.card.notFoundText')}</p>
                <Link to="/admin/users" className={styles.link}>{t('staff.card.backToList')}<ChevronRight aria-hidden /></Link>
              </>
            ) : <LoadError error={query.error} onRetry={() => void query.refetch()} variant="block" context={t('staff.card.loadError')} text={t('staff.card.loadErrorText')} />}
        </div>
      </aside>
    );
  }
  return <CardBody user={user} viewer={viewer} variant={variant} onClose={onClose} onDialog={onDialog} />;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return <button type="button" className={styles.close} aria-label={t('staff.card.close')} title={t('staff.card.close')} onClick={onClose}><X aria-hidden /></button>;
}

/** Bo'lim: sarlavha, izoh; amal — o'ngda yoki izoh ostida (`actionBelow`: «Faol sessiyalar» → «Hammasini tugatish»). */
function Section({ title, sub, action, actionBelow, children, labelledBy }: { title: string; sub?: string; action?: ReactNode; actionBelow?: ReactNode; children: ReactNode; labelledBy?: string }) {
  return (
    <section className={styles.section} aria-labelledby={labelledBy}>
      <div className={styles.sectionHead}>
        <div>
          <h3 id={labelledBy}>{title}</h3>
          {sub ? <p>{sub}</p> : null}
          {actionBelow ? <div className={styles.actionBelow}>{actionBelow}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function CardBody({ user, viewer, variant, onClose, onDialog }: { user: UserAccount; viewer: { id: string; role: UserRole }; variant: CardVariant; onClose?: () => void; onDialog: (state: StaffDialogState) => void }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const status = accountStatus(user);
  const allowed = staffPermissions(viewer, user);
  const self = viewer.id === user.id;
  const blocked = user.isBlocked;
  const superView = user.role === 'SUPERADMIN' && viewer.role !== 'SUPERADMIN';
  const operator = user.role === 'OPERATOR_LEAD';
  const sessions = useUserSessionsQuery(user.id);
  const logins = useUserLoginsQuery(user.id, status !== 'NEVER_LOGGED_IN');
  const actions = useUserActionsQuery(user.id, status !== 'NEVER_LOGGED_IN');
  // Operator softfon hisobi va ish joyi (taklif §13): backendda yo'q bo'lsa — qatorlar chiqmaydi.
  const softphones = useSoftphonesQuery(operator);
  const softphone = softphones.data?.find((item) => item.operatorId === user.id);
  const resend = useResendWelcomeSmsMutation();
  const unblock = useUnblockUser((target) => onDialog({ kind: 'password', user: target }));
  const name = displayName(user);
  const reason = (key: keyof typeof allowed) => (allowed[key] ? t(denialKey(key, allowed[key])) : null);
  const titleId = `staff-card-${user.code}`;

  const resendSms = () => resend.mutate(user.id, {
    onSuccess: () => void message.success(t('staff.note.smsSent')),
    onError: (error) => void message.error(`${t('staff.note.smsFailed')}: ${getApiErrorMessage(error)}`),
  });

  const head = (
    <div className={styles.head}>
      <Avatar name={user.name || user.phone} size={48} />
      <div className={styles.headText}>
        {variant === 'page' ? null : <h2 id={titleId}>{name}{self ? ` ${t('staff.you')}` : ''}</h2>}
        <div className={styles.chips}>
          {user.role ? <span className={styles.chip}>{t(ROLE_LABEL_KEYS[user.role])}</span> : null}
          <AccountStatusBadge user={user} />
          <span className={styles.code}>{t('staff.card.id', { code: user.code })}</span>
        </div>
      </div>
      {onClose ? <CloseButton onClose={onClose} /> : null}
    </div>
  );

  const note = status === 'NEVER_LOGGED_IN' ? (
    <div className={styles.note} data-tone="info" role="note">
      <Info aria-hidden />
      <div>
        <p className={styles.noteTitle}>{t('staff.note.newTitle')}</p>
        <p className={styles.noteText}>
          {user.temporaryPassword
            ? t(user.temporaryPassword.smsSentAt ? 'staff.note.newSms' : 'staff.note.newNoSms', { time: momentText(user.temporaryPassword.smsSentAt ?? user.temporaryPassword.issuedAt), phone: formatUzPhone(user.phone) })
            : t('staff.note.newPlain')}
        </p>
        <div className={styles.noteAction}>
          <button type="button" className={styles.linkButton} onClick={resendSms} disabled={resend.isPending}>{t('staff.note.resendSms')}</button>
        </div>
      </div>
    </div>
  ) : blocked ? (
    <div className={styles.note} data-tone="danger" role="note">
      <CircleX aria-hidden />
      <div>
        <p className={styles.noteTitle}>{t('staff.note.blockedTitle')}</p>
        <p className={styles.noteText}>
          {user.block
            ? t(operator ? 'staff.note.blockedTextOperator' : 'staff.note.blockedText', {
              when: tashkentDateTime(user.block.at),
              // «Nodira K. Sabab: …» — qisqa ism nuqta bilan tugaydi, shablondagi nuqta takrorlanmasin.
              by: shortPersonName(user.block.by).replace(/\.$/, ''),
              reason: user.block.reason ?? t('staff.note.blockedNoReason'),
            })
            : t('staff.note.blockedPlain')}
        </p>
      </div>
    </div>
  ) : superView ? (
    <div className={styles.note} data-tone="neutral" role="note">
      <Info aria-hidden />
      <div>
        <p className={styles.noteTitle}>{t('staff.note.superTitle')}</p>
        <p className={styles.noteText}>{t('staff.note.superText')}</p>
      </div>
    </div>
  ) : null;

  const login = user.role ? roleInfo(user.role).login : 'password';
  const contact = (
    <Section title={t('staff.card.contact')}>
      <dl className={styles.facts}>
        <div><dt>{t('staff.card.phone')}</dt><dd>{formatUzPhone(user.phone)}<span className={styles.ddHint}>{t('staff.card.phoneHint')}</span></dd></div>
        <div><dt>{t('staff.card.loginMethod')}</dt><dd>{t(LOGIN_METHOD_KEYS[login])}</dd></div>
        {user.createdAt ? (
          <div><dt>{t('staff.card.created')}</dt><dd>{[dayText(user.createdAt, t), user.createdBy ? shortPersonName(user.createdBy.name) : null].filter(Boolean).join(' · ')}</dd></div>
        ) : null}
        <div>
          <dt>{t('staff.card.lastLogin')}</dt>
          <dd>{user.lastLoginAt ? lastLoginText(user.lastLoginAt, t) : user.lastLoginAt === null ? <span className={styles.muted}>{t('staff.never')}</span> : '—'}</dd>
        </div>
      </dl>
    </Section>
  );

  const workplace = operator ? (
    <Section title={t('staff.card.workplace')} action={<Link to="/admin/users?tab=teams" className={styles.link}>{t('staff.toTeams')}<ChevronRight aria-hidden /></Link>}>
      <dl className={styles.facts}>
        <div><dt>{t('staff.card.team')}</dt><dd>{user.team ? t('staff.card.teamValue', { name: shortPersonName(user.team.supervisorName) }) : <span className={styles.muted}>{t('staff.card.noTeam')}</span>}</dd></div>
        {softphone ? (
          <div>
            <dt>{t('staff.card.softphone')}</dt>
            <dd>
              <span className={styles.chips}>
                <span className={styles.chip}>{softphone.account}</span>
                <span className={styles.muted}>{softphone.neverConnected && softphone.status === 'UNREGISTERED' ? t('staff.ops.spFirst') : t(`staff.ops.spLower.${softphone.status}`)}</span>
              </span>
            </dd>
          </div>
        ) : null}
        {softphone && !blocked ? <div><dt>{t('staff.card.workspace')}</dt><dd>{t(`staff.ops.ws.${softphone.workspace}`)}</dd></div> : null}
      </dl>
    </Section>
  ) : null;

  const roleDenied = reason('changeRole');
  const roleSection = blocked ? null : (
    <Section title={t('staff.card.role')} labelledBy={`${titleId}-role`}>
      {user.role ? (
        <>
          <div className={styles.roleText}>
            <p className={styles.strong}>{t(ROLE_LABEL_KEYS[user.role])}</p>
            <p className={styles.muted}>{t(roleInfo(user.role).job)}</p>
          </div>
          <div className={styles.menuBox}>
            <p className={styles.boxLabel}>{t('staff.role.menu')}</p>
            <p className={styles.boxValue}>{roleMenuKeys(user.role).map((key) => t(key)).join(' · ')}</p>
          </div>
        </>
      ) : <p className={styles.muted}>{t('staff.card.roleUnknown')}</p>}
      <div className={styles.actionStack}>
        <button type="button" className={styles.secondary} disabled={Boolean(roleDenied)} aria-describedby={roleDenied ? `${titleId}-role-why` : undefined} onClick={() => onDialog({ kind: 'role', user })}>
          <UserCog aria-hidden />{t(user.role ? 'staff.menu.role' : 'staff.giveRole')}
        </button>
        {roleDenied ? <p id={`${titleId}-role-why`} className={styles.why}>{roleDenied}</p> : null}
      </div>
    </Section>
  );

  const passwordDenied = reason('resetPassword');
  const tfa = twoFactorState(user);
  const security = blocked ? null : (
    <Section title={t('staff.card.security')}>
      <div className={styles.row}>
        <span className={styles.rowText}>
          <span className={styles.strong}>{t('staff.card.password')}</span>
          <span className={styles.small}>
            {user.temporaryPassword ? t('staff.card.passwordTemp', { when: lastLoginText(user.temporaryPassword.issuedAt, t) })
              : user.passwordSetAt ? t('staff.card.passwordSet', { date: tashkentDay(user.passwordSetAt) }) : '—'}
          </span>
        </span>
        <button type="button" className={styles.secondary} disabled={Boolean(passwordDenied)} onClick={() => onDialog({ kind: 'password', user })}>
          <KeyRound aria-hidden />{t('staff.card.resetPassword')}
        </button>
      </div>
      {passwordDenied ? (
        <div className={styles.whyRow}>
          <p className={styles.why}>{passwordDenied}</p>
          {allowed.resetPassword === 'self' ? <Link to="/admin/profile" className={styles.link}>{t('staff.card.openProfile')}<ChevronRight aria-hidden /></Link> : null}
        </div>
      ) : null}
      {usesTwoFactor(user.role) ? (
        <div className={styles.row} data-divided>
          <span className={styles.rowText} data-gap>
            <span className={styles.strong}>{t('staff.card.tfa')}</span>
            <span className={styles.inline}>
              {tfa === 'CONNECTED' ? <><Badge tone="success" icon={CircleCheck}>{t('staff.tfa.connected')}</Badge><span className={styles.small}>{tashkentDay(user.totpEnabledAt ?? '')}</span></>
                : tfa === 'RESET' && user.twoFactorReset ? <><Badge tone="warning" icon={RotateCcw}>{t('staff.tfa.reset')}</Badge><span className={styles.small}>{`${momentText(user.twoFactorReset.at)} · ${shortPersonName(user.twoFactorReset.by)}`}</span></>
                  : <Badge tone="neutral" icon={ShieldCheck}>{t('staff.tfa.pending')}</Badge>}
            </span>
          </span>
          {allowed.resetTwoFactor ? (
            <span className={styles.lockNote}><Lock aria-hidden />{t('staff.card.tfaSuperOnly')}</span>
          ) : (
            <button type="button" className={styles.secondary} onClick={() => onDialog({ kind: 'tfa', user })}><RotateCcw aria-hidden />{t('staff.card.tfaResetAction')}</button>
          )}
        </div>
      ) : null}
    </Section>
  );

  const list = sessions.data;
  const sessionsDenied = reason('endSessions');
  const sessionsSection = (
    <Section
      title={list ? t('staff.card.sessions', { count: list.length }) : t('staff.card.sessionsTitle')}
      sub={blocked || !list?.length ? undefined : self ? t('staff.card.sessionsSelf') : sessionsDenied ? undefined : t('staff.card.sessionsSub')}
      actionBelow={!blocked && list && list.length > 0 && !sessionsDenied ? (
        <button type="button" className={styles.dangerLink} onClick={() => onDialog({ kind: 'sessions', user, session: null })}>{t('staff.card.endAll')}</button>
      ) : undefined}
    >
      {sessions.isPending ? <p className={styles.muted}>{t('staff.card.loading')}</p>
        : sessions.isError ? <LoadError error={sessions.error} onRetry={() => void sessions.refetch()} variant="row" />
          : list === null ? <p className={styles.muted}>{t('staff.card.sessionsUnavailable')}</p>
            : !list?.length ? <p className={styles.muted}>{t(blocked ? 'staff.card.sessionsBlocked' : status === 'NEVER_LOGGED_IN' ? 'staff.card.noSessions' : 'staff.card.sessionsNone')}</p>
              : (
                <ul className={styles.list}>
                  {list.map((session) => (
                    <li key={session.id}>
                      <SessionRow
                        session={session}
                        trailing={session.current ? <Badge tone="success" icon={CircleCheck}>{t('staff.card.activeNow')}</Badge>
                          : sessionsDenied ? null : (
                            <button type="button" className={styles.secondary} aria-label={t('staff.card.endAria', { device: `${session.browser} · ${session.os}` })} onClick={() => onDialog({ kind: 'sessions', user, session })}>
                              <LogOut aria-hidden />{t('staff.card.end')}
                            </button>
                          )}
                      />
                    </li>
                  ))}
                </ul>
              )}
    </Section>
  );

  const loginItems = logins.data;
  const loginsSection = loginItems?.length ? (
    <Section title={t('staff.card.logins')} sub={t('staff.card.loginsSub')} action={<Link to="/admin/audit-logs" className={styles.link}>{t('staff.card.auditLink')}<ChevronRight aria-hidden /></Link>}>
      <ul className={styles.log}>
        {loginItems.map((event) => {
          const ok = event.outcome === 'SUCCESS';
          return (
            <li key={`${event.at}-${event.outcome}`}>
              <span className={styles.logTime}>{lastLoginText(event.at, t)}</span>
              <span className={styles.logIcon} data-ok={ok || undefined} aria-hidden>{ok ? <CircleCheck /> : <CircleX />}</span>
              <span className={styles.logText}>
                <span className={styles.logTitle} data-error={!ok || undefined}>{t(ok ? `staff.log.${event.method}` : `staff.log.${event.outcome as Exclude<typeof event.outcome, 'SUCCESS'>}`)}</span>
                <span className={styles.small}>{[event.browser, event.os, event.ip].filter(Boolean).join(' · ')}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  ) : null;

  const actionItems = actions.data;
  const actionsSection = actionItems?.length ? (
    <Section title={t('staff.card.actions')} sub={t('staff.card.actionsSub')}>
      <ul className={styles.log}>
        {actionItems.map((entry) => {
          const text = auditText(entry, t);
          return (
            <li key={entry.id}>
              <span className={styles.logTime}>{lastLoginText(entry.createdAt, t)}</span>
              <span className={styles.logText}>
                <span className={styles.logTitle}>{text.title}</span>
                {text.detail ? <span className={styles.small}>{text.detail}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  ) : null;

  const blockDenied = reason('block');
  const footer = (
    <div className={styles.footer}>
      {blocked ? (
        <>
          <button type="button" className={styles.footerSecondary} disabled={Boolean(blockDenied) || unblock.pending} onClick={() => unblock.run(user)}>
            <ShieldCheck aria-hidden />{t('staff.card.unblock')}
          </button>
          <p className={styles.why}>{blockDenied ?? t(operator ? 'staff.card.unblockHintOperator' : 'staff.card.unblockHint')}</p>
        </>
      ) : (
        <>
          <button type="button" className={styles.footerDanger} disabled={Boolean(blockDenied)} onClick={() => onDialog({ kind: 'block', user })}>
            <Ban aria-hidden />{t(status === 'NEVER_LOGGED_IN' ? 'staff.card.blockNew' : 'staff.card.block')}
          </button>
          <p className={styles.why}>{blockDenied ?? t('staff.card.blockHint')}</p>
        </>
      )}
    </div>
  );

  return (
    <aside className={styles.card} data-variant={variant} aria-labelledby={variant === 'page' ? undefined : titleId} data-testid="staff-card">
      {head}
      {note ? <div className={styles.noteWrap}>{note}</div> : null}
      {contact}
      {workplace}
      {roleSection}
      {security}
      {sessionsSection}
      {loginsSection}
      {actionsSection}
      {footer}
    </aside>
  );
}
