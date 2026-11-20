import { App, Form, Input, Skeleton } from 'antd';
import { Check, ChevronRight, CircleCheck, CreditCard, Lock, LogOut, Monitor, Pencil, ScrollText, Smartphone } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthSessionsQuery, useRevokeAuthSessionMutation } from '../../features/auth/api/authQueries';
import { useLogoutMutation } from '../../features/auth/api/useLogoutMutation';
import { deviceLabel } from '../../features/auth/lib/deviceLabel';
import {
  useSellerProfileQuery,
  useUpdateSellerNameMutation,
  type SellerProfile,
} from '../../features/sellerProfile/api/sellerProfileApi';
import { selfEmployedStatusKey } from '../../features/sellerProfile/lib/selfEmployedStatus';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { initials } from '../../shared/lib/initials';
import { formatUzPhone } from '../../shared/lib/phone';
import { tashkentClock, tashkentDate, tashkentDateTime } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { SheetModal } from '../../shared/ui/SheetModal/SheetModal';
import e from './profileE.module.css';
import styles from './sellerProfile.module.css';

const dateOnly = (iso: string) => tashkentDateTime(iso).slice(0, 10);

/**
 * Sotuvchi «Profil» (sotuvchi-profil): hisob, pul yechishga tayyorlik, shaxsiy ma'lumot,
 * JShShIR, kirish va sessiyalar, karta, oferta. Ism ro'yxatda so'ralmaydi — shu yerda kiritiladi.
 */
export default function SellerProfilePage() {
  const { t } = useTranslation();
  const query = useSellerProfileQuery();
  const [editing, setEditing] = useState(false);

  if (query.isError && !query.data) {
    return <LoadError variant="page" error={query.error} onRetry={() => void query.refetch()} lastSuccessAt={query.dataUpdatedAt} />;
  }
  if (!query.data) return <Skeleton active paragraph={{ rows: 8 }} />;

  const profile = query.data;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const today = tashkentDate();
  const relative = (iso: string) => (tashkentDate(new Date(iso)) === today ? t('sellerProfile.today', { time: tashkentClock(new Date(iso)) }) : tashkentDateTime(iso));
  const offer = profile.agreements.find((item) => item.type === 'affiliate-offer' && item.current);
  const consent = profile.agreements.find((item) => item.type === 'personal-data-consent' && item.current);
  const selfEmployed = profile.selfEmployed;

  const readiness = [
    { key: 'phone', title: t('sellerProfile.stepPhone'), text: t('sellerProfile.stepPhoneText', { date: dateOnly(profile.registeredAt) }), done: true },
    {
      key: 'offer',
      title: t('sellerProfile.stepOffer'),
      text: offer ? t('sellerProfile.stepOfferText', { version: offer.version, time: tashkentDateTime(offer.acceptedAt) }) : t('sellerProfile.stepTodo'),
      done: Boolean(offer),
      link: { to: '/profile/offer', label: t('sellerProfile.agreementsTitle') },
    },
    {
      key: 'self-employed',
      title: t('sellerProfile.stepSelfEmployed'),
      text: t(selfEmployedStatusKey(selfEmployed.status)).toLocaleLowerCase(),
      done: selfEmployed.status === 'VERIFIED',
      link: { to: '/profile/self-employed', label: t('sellerProfile.selfEmployedLink') },
    },
    {
      key: 'card',
      title: t('sellerProfile.stepCard'),
      text: profile.card ? `${profile.card.brand === 'HUMO' ? 'Humo' : 'Uzcard'} ···· ${profile.card.last4}` : t('sellerProfile.cardMissing'),
      done: Boolean(profile.card),
    },
  ];
  const doneCount = readiness.filter((step) => step.done).length;
  const ready = doneCount === readiness.length;
  const firstTodo = readiness.findIndex((step) => !step.done);
  const lastLogin = profile.lastLoginAt ? relative(profile.lastLoginAt) : null;
  const statusTone = selfEmployed.status === 'VERIFIED' ? 'success' : selfEmployed.status === 'PENDING' ? 'info' : selfEmployed.status === 'NOT_SUBMITTED' ? 'neutral' : 'danger';
  const cardBrand = profile.card ? (profile.card.brand === 'HUMO' ? 'Humo' : 'Uzcard') : null;

  return (
    <div className={e.page}>
      <section className={`${e.card} ${styles.accountRow}`} aria-label={t('sellerProfile.title')}>
        <span className={styles.accountAvatar} aria-hidden>{initials(fullName)}</span>
        <div className={styles.accountMain}>
          <p className={styles.accountTitle}>{fullName || formatUzPhone(profile.phone)}</p>
          <div className={styles.accountChips}>
            <span className={styles.roleChip}>{t('sellerProfile.seller')}</span>
            <span className={e.chip} data-tone="success"><CircleCheck aria-hidden />{t('sellerProfile.active')}</span>
            <span className={e.sub}>{t('sellerProfile.registered', { date: dateOnly(profile.registeredAt) })}</span>
          </div>
        </div>
        {lastLogin ? (
          <div className={styles.accountLogin}>
            <span className={e.sub}>{t('sellerProfile.lastLoginLabel')}</span>
            <span className={e.val}>{lastLogin}</span>
          </div>
        ) : null}
      </section>

      <section className={e.card} aria-labelledby="profile-readiness">
        <div className={e.sectionHead}>
          <div>
            <h2 id="profile-readiness" className={e.h2}>{ready ? t('sellerProfile.readyTitle') : t('sellerProfile.notReadyTitle')}</h2>
            <p className={e.lead}>{ready ? t('sellerProfile.readyText') : t('sellerProfile.notReadyText')}</p>
          </div>
          {ready ? (
            <span className={e.chip} data-tone="success"><CircleCheck aria-hidden />{t('sellerProfile.readyBadge')}</span>
          ) : (
            <span className={e.chip} data-tone="neutral">{t('sellerProfile.notReadyBadge', { done: doneCount })}</span>
          )}
        </div>
        <ol className={styles.stepper} aria-label={t('sellerProfile.readiness')}>
          {readiness.map((step, index) => {
            const state = step.done ? 'done' : index === firstTodo ? 'current' : 'todo';
            return (
              <li key={step.key} data-state={state}>
                <span className={styles.stepTrack}>
                  <span className={styles.stepDot} aria-hidden>{step.done ? <Check /> : index + 1}</span>
                  {index < readiness.length - 1 ? <span className={styles.stepLine} data-done={step.done || undefined} /> : null}
                </span>
                <span className={styles.stepText}>
                  <span className={styles.stepTitle}>
                    {step.title}
                    <span className={styles.srOnly}> — {step.done ? t('sellerProfile.stepDone') : t('sellerProfile.stepTodo')}</span>
                  </span>
                  <span className={styles.stepSub}>{step.text}</span>
                  {step.link ? (
                    <Link to={step.link.to} className={`${e.link} ${styles.stepLink}`}>
                      {step.link.label}
                      <ChevronRight aria-hidden />
                    </Link>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className={e.cols}>
        <div className={e.colMain}>
          <section className={e.card} data-gap="4" aria-labelledby="profile-personal">
            <div className={e.sectionHead}>
              <div><h2 id="profile-personal" className={e.h2}>{t('sellerProfile.personalTitle')}</h2></div>
              <button type="button" className={`${e.btn} ${e.btnSmall}`} onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                {t('sellerProfile.edit')}
              </button>
            </div>
            <dl className={`${e.rows} ${styles.rowsTop}`}>
              <Row label={t('sellerProfile.firstName')} value={profile.firstName || <span className={e.placeholder}>{t('sellerProfile.notFilled')}</span>} />
              <Row label={t('sellerProfile.lastName')} value={profile.lastName || <span className={e.placeholder}>{t('sellerProfile.notFilled')}</span>} />
              <Row label={t('sellerProfile.phone')} value={formatUzPhone(profile.phone)} sub={t('sellerProfile.phoneHint')} />
            </dl>
            <p className={`${e.note} ${styles.noteTop}`}>{t('sellerProfile.nameNote')}</p>
          </section>

          <section className={e.card} data-gap="10" aria-labelledby="profile-self-employed">
            <div className={e.sectionHead}>
              <div><h2 id="profile-self-employed" className={e.h2}>{t('sellerProfile.selfEmployedSection')}</h2></div>
              <span className={e.chip} data-tone={statusTone}>
                {selfEmployed.status === 'VERIFIED' ? <CircleCheck aria-hidden /> : null}
                {t(selfEmployedStatusKey(selfEmployed.status))}
              </span>
            </div>
            <dl className={`${e.rows} ${styles.rowsTop}`}>
              <Row label={t('sellerProfile.pinfl')} value={selfEmployed.pinflLast4 ? `···· ${selfEmployed.pinflLast4}` : '—'} />
              <Row label={t('sellerProfile.activity')} value={selfEmployed.activity ?? t('sellerProfile.activityValue')} sub={t('sellerProfile.activityNote')} />
              {selfEmployed.checkedAt ? (
                <Row label={t('sellerProfile.checkedAt')} value={tashkentDateTime(selfEmployed.checkedAt)} />
              ) : selfEmployed.submittedAt ? (
                <Row label={t('sellerProfile.submittedAt')} value={tashkentDateTime(selfEmployed.submittedAt)} />
              ) : null}
              <Row label={t('sellerProfile.tax')} value={t('sellerProfile.taxValue')} sub={t('sellerProfile.taxSub')} />
            </dl>
            <div className={styles.linkRow}>
              <Link to="/profile/self-employed" className={e.link}>
                {t('sellerProfile.selfEmployedLink')}
                <ChevronRight aria-hidden />
              </Link>
            </div>
          </section>

          <SecuritySection phone={profile.phone} />
        </div>

        <div className={e.colSide}>
          <section className={e.card} data-gap="14" aria-labelledby="profile-card">
            <div className={e.sectionHead}>
              <div><h2 id="profile-card" className={e.h2}>{t('sellerProfile.cardTitle')}</h2></div>
            </div>
            {profile.card && cardBrand ? (
              <div className={styles.cardTile}>
                <span className={styles.cardBrand}><CreditCard aria-hidden />{cardBrand}</span>
                <span className={styles.cardNumber}>···· {profile.card.last4}</span>
                <span className={styles.cardAdded}>{t('sellerProfile.cardAdded', { date: dateOnly(profile.card.addedAt) })}</span>
              </div>
            ) : (
              <p className={styles.emptyLine}>{t('sellerProfile.cardNone')}</p>
            )}
            <p className={styles.bodyText}>{t('sellerProfile.cardText')}</p>
            <p className={e.small}>{t('sellerProfile.cardPrivacy')}</p>
            {/* Karta qo'shish va almashtirish — FE-07 (balans va pul yechish). */}
            <Link to="/affiliate/balance" className={`${e.btn} ${e.btnBlock}`}>{profile.card ? t('sellerProfile.cardChange') : t('sellerProfile.cardAdd')}</Link>
          </section>

          <section className={e.card} data-gap="14" aria-labelledby="profile-agreements">
            <div className={e.sectionHead}>
              <div><h2 id="profile-agreements" className={e.h2}>{t('sellerProfile.agreementsTitle')}</h2></div>
            </div>
            <div className={styles.docRow}>
              <span className={styles.docBox} aria-hidden><ScrollText /></span>
              <span className={styles.docText}>
                <span className={styles.docName}>{t('agreements.offerName')}</span>
                <span className={e.sub}>{offer ? t('sellerProfile.offerAccepted', { version: offer.version, time: tashkentDateTime(offer.acceptedAt) }) : '—'}</span>
              </span>
            </div>
            <div className={styles.docRow}>
              <span className={styles.docBox} aria-hidden><Lock /></span>
              <span className={styles.docText}>
                <span className={styles.docName}>{t('sellerProfile.consentShort')}</span>
                <span className={e.sub}>{consent ? t('sellerProfile.consentGiven', { time: tashkentDateTime(consent.acceptedAt) }) : '—'}</span>
              </span>
            </div>
            <div className={styles.docFoot}>
              <Link to="/profile/offer" className={e.link}>
                {t('sellerProfile.open')}
                <ChevronRight aria-hidden />
              </Link>
              <p className={e.small}>{t('sellerProfile.agreementsNote')}</p>
            </div>
          </section>
        </div>
      </div>

      <EditNameModal open={editing} profile={profile} onClose={() => setEditing(false)} />
    </div>
  );
}

/** Qator: yorliq 168 px, qiymat (14/600) va izoh (13). */
function Row({ label, value, sub, action }: { label: string; value: ReactNode; sub?: string; action?: ReactNode }) {
  return (
    <div className={e.row}>
      <dt className={e.rowLabel}>{label}</dt>
      <dd className={e.rowValue}>
        <span className={e.rowMain}>
          <span className={e.val}>{value}</span>
          {sub ? <span className={e.sub}>{sub}</span> : null}
        </span>
        {action}
      </dd>
    </div>
  );
}

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile/i;

function SecuritySection({ phone }: { phone: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const sessions = useAuthSessionsQuery();
  const revoke = useRevokeAuthSessionMutation();
  const logout = useLogoutMutation();
  const today = tashkentDate();
  const when = (iso: string) => (tashkentDate(new Date(iso)) === today ? t('sellerProfile.today', { time: tashkentClock(new Date(iso)) }) : tashkentDateTime(iso));

  return (
    <section className={e.card} data-gap="8" aria-labelledby="profile-security">
      <div className={e.sectionHead}>
        <div><h2 id="profile-security" className={e.h2}>{t('sellerProfile.securityTitle')}</h2></div>
        <button type="button" className={`${e.btn} ${e.btnSmall}`} disabled={logout.isPending} aria-busy={logout.isPending || undefined} onClick={() => logout.mutate()}>
          <LogOut aria-hidden />
          {t('sellerProfile.logout')}
        </button>
      </div>
      <dl className={e.rows}>
        <Row label={t('sellerProfile.loginMethod')} value={t('sellerProfile.loginMethodValue')} sub={t('sellerProfile.loginMethodText', { phone: formatUzPhone(phone) })} />
      </dl>
      {sessions.data ? (
        <>
          <div className={styles.sessionsHead}>
            <h3>
              {t('sellerProfile.sessionsTitle')} <span className={styles.sessionsCount}>· {sessions.data.length}</span>
            </h3>
          </div>
          <ul className={styles.sessionList} aria-label={t('sellerProfile.sessions', { count: sessions.data.length })}>
            {sessions.data.map((session) => {
              const device = deviceLabel(session.userAgent);
              const DeviceIcon = MOBILE_UA.test(session.userAgent ?? '') ? Smartphone : Monitor;
              return (
                <li key={session.id}>
                  <span className={styles.sessionIcon} aria-hidden><DeviceIcon /></span>
                  <div className={styles.sessionText}>
                    <span className={styles.sessionName}>
                      {device}
                      {session.current ? <span className={e.chip} data-tone="success"><CircleCheck aria-hidden />{t('sellerProfile.thisDevice')}</span> : null}
                    </span>
                    <span className={e.sub}>
                      {session.current
                        ? t('sellerProfile.signedIn', { time: when(session.createdAt) })
                        : t('sellerProfile.lastActive', { time: when(session.lastUsedAt ?? session.createdAt) })}
                    </span>
                  </div>
                  {session.current ? null : (
                    <button
                      type="button"
                      className={`${e.btn} ${e.btnSmall}`}
                      aria-label={t('sellerProfile.closeSessionAria', { device })}
                      disabled={revoke.isPending && revoke.variables === session.id}
                      onClick={() =>
                        revoke.mutate(session.id, {
                          onSuccess: () => void message.success(t('sellerProfile.sessionClosed')),
                          onError: (error) => void message.error(getApiErrorMessage(error)),
                        })
                      }
                    >
                      <LogOut aria-hidden />
                      {t('sellerProfile.closeSession')}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className={e.note}>{t('sellerProfile.sessionsNote')}</p>
        </>
      ) : sessions.isPending ? (
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      ) : null}
    </section>
  );
}

function EditNameModal({ open, profile, onClose }: { open: boolean; profile: SellerProfile; onClose: () => void }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ firstName: string; lastName: string }>();
  const update = useUpdateSellerNameMutation();
  const verified = profile.selfEmployed.status === 'VERIFIED';

  const submit = (values: { firstName: string; lastName: string }) => {
    update.mutate(
      { firstName: values.firstName.trim(), lastName: values.lastName.trim() },
      {
        onSuccess: () => {
          void message.success(t('sellerProfile.saved'));
          onClose();
        },
        onError: (error) => void message.error(getApiErrorMessage(error)),
      },
    );
  };

  return (
    <SheetModal
      open={open}
      width={480}
      title={t('sellerProfile.editTitle')}
      okText={t('sellerProfile.save')}
      cancelText={t('sellerProfile.cancel')}
      confirmLoading={update.isPending}
      destroyOnHidden
      onOk={() => form.submit()}
      onCancel={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ firstName: profile.firstName, lastName: profile.lastName }}
        onFinish={submit}
      >
        <Form.Item label={t('sellerProfile.firstName')} name="firstName" rules={[{ required: true, whitespace: true, message: t('sellerProfile.firstNameRequired') }, { max: 60 }]}>
          <Input autoComplete="given-name" maxLength={60} />
        </Form.Item>
        <Form.Item label={t('sellerProfile.lastName')} name="lastName" rules={[{ required: true, whitespace: true, message: t('sellerProfile.lastNameRequired') }, { max: 60 }]}>
          <Input autoComplete="family-name" maxLength={60} />
        </Form.Item>
        <p className={styles.note}>{verified ? t('sellerProfile.nameRecheck') : t('sellerProfile.nameNote')}</p>
      </Form>
    </SheetModal>
  );
}
