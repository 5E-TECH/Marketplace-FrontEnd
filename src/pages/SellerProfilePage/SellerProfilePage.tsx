import { App, Button, Form, Input, Skeleton, Tag } from 'antd';
import { Check, CreditCard, FileText, LogOut, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthSessionsQuery, useRevokeAuthSessionMutation } from '../../features/auth/api/authQueries';
import { useLogoutMutation } from '../../features/auth/api/useLogoutMutation';
import { deviceLabel } from '../../features/auth/lib/deviceLabel';
import {
  useSellerProfileQuery,
  useUpdateSellerNameMutation,
  type SellerProfile,
} from '../../features/sellerProfile/api/sellerProfileApi';
import { selfEmployedStatusColor, selfEmployedStatusKey } from '../../features/sellerProfile/lib/selfEmployedStatus';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { initials } from '../../shared/lib/initials';
import { formatUzPhone } from '../../shared/lib/phone';
import { tashkentClock, tashkentDate, tashkentDateTime } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { SheetModal } from '../../shared/ui/SheetModal/SheetModal';
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
    return <LoadError error={query.error} onRetry={() => void query.refetch()} lastSuccessAt={query.dataUpdatedAt} />;
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

  return (
    <div className={styles.page}>
      <section className={`${styles.card} ${styles.account}`} aria-label={t('sellerProfile.title')}>
        <span className={styles.avatar} aria-hidden>{initials(fullName)}</span>
        <div className={styles.accountText}>
          <strong className={styles.accountName}>{fullName || formatUzPhone(profile.phone)}</strong>
          <span className={styles.tags}>
            <Tag>{t('sellerProfile.seller')}</Tag>
            <Tag color="success">{t('sellerProfile.active')}</Tag>
          </span>
        </div>
        <p className={styles.accountMeta}>
          <span>{t('sellerProfile.registered', { date: dateOnly(profile.registeredAt) })}</span>
          {profile.lastLoginAt ? <span>{t('sellerProfile.lastLogin', { time: relative(profile.lastLoginAt) })}</span> : null}
        </p>
      </section>

      <section className={styles.card} aria-labelledby="profile-readiness">
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 id="profile-readiness">{ready ? t('sellerProfile.readyTitle') : t('sellerProfile.notReadyTitle')}</h2>
            <p className={styles.muted}>{ready ? t('sellerProfile.readyText') : t('sellerProfile.notReadyText')}</p>
          </div>
          <Tag color={ready ? 'success' : 'default'}>{ready ? t('sellerProfile.readyBadge') : t('sellerProfile.notReadyBadge', { done: doneCount })}</Tag>
        </header>
        <ol className={styles.readiness} aria-label={t('sellerProfile.readiness')}>
          {readiness.map((step) => (
            <li key={step.key} data-done={step.done}>
              <span className={styles.readinessIcon} aria-hidden>{step.done ? <Check size={14} /> : null}</span>
              <span className={styles.readinessText}>
                <strong>{step.title} — {step.done ? t('sellerProfile.stepDone') : t('sellerProfile.stepTodo')}</strong>
                <span className={styles.muted}>{step.text}</span>
              </span>
              {step.link ? <Link to={step.link.to} className={styles.link}>{step.link.label}</Link> : null}
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="profile-personal">
          <header className={styles.head}>
            <h2 id="profile-personal">{t('sellerProfile.personalTitle')}</h2>
            <Button onClick={() => setEditing(true)}>{t('sellerProfile.edit')}</Button>
          </header>
          <dl className={styles.fields}>
            <div><dt>{t('sellerProfile.firstName')}</dt><dd>{profile.firstName || <span className={styles.muted}>{t('sellerProfile.notFilled')}</span>}</dd></div>
            <div><dt>{t('sellerProfile.lastName')}</dt><dd>{profile.lastName || <span className={styles.muted}>{t('sellerProfile.notFilled')}</span>}</dd></div>
            <div className={styles.wide}>
              <dt>{t('sellerProfile.phone')}</dt>
              <dd className={styles.numeric}>{formatUzPhone(profile.phone)}</dd>
              <dd className={styles.muted}>{t('sellerProfile.phoneHint')}</dd>
            </div>
          </dl>
          <p className={styles.note}>{t('sellerProfile.nameNote')}</p>
        </section>

        <section className={styles.card} aria-labelledby="profile-self-employed">
          <header className={styles.head}>
            <h2 id="profile-self-employed">{t('sellerProfile.selfEmployedSection')}</h2>
            <Tag color={selfEmployedStatusColor[selfEmployed.status]}>{t(selfEmployedStatusKey(selfEmployed.status))}</Tag>
          </header>
          <dl className={styles.fields}>
            <div><dt>{t('sellerProfile.pinfl')}</dt><dd className={styles.numeric}>{selfEmployed.pinflLast4 ? `···· ${selfEmployed.pinflLast4}` : '—'}</dd></div>
            <div>
              <dt>{t('sellerProfile.activity')}</dt>
              <dd>{selfEmployed.activity ?? t('sellerProfile.activityValue')}</dd>
              <dd className={styles.muted}>{t('sellerProfile.activityNote')}</dd>
            </div>
            {selfEmployed.checkedAt ? (
              <div><dt>{t('sellerProfile.checkedAt')}</dt><dd>{tashkentDateTime(selfEmployed.checkedAt)}</dd></div>
            ) : selfEmployed.submittedAt ? (
              <div><dt>{t('sellerProfile.submittedAt')}</dt><dd>{tashkentDateTime(selfEmployed.submittedAt)}</dd></div>
            ) : null}
            <div><dt>{t('sellerProfile.tax')}</dt><dd>{t('sellerProfile.taxText')}</dd></div>
          </dl>
          <Link to="/profile/self-employed" className={styles.link}>{t('sellerProfile.selfEmployedLink')}</Link>
        </section>

        <SecuritySection phone={profile.phone} />

        <section className={styles.card} aria-labelledby="profile-card">
          <header className={styles.head}>
            <h2 id="profile-card">{t('sellerProfile.cardTitle')}</h2>
          </header>
          {profile.card ? (
            <div className={styles.cardRow}>
              <CreditCard aria-hidden />
              <span className={styles.readinessText}>
                <strong className={styles.numeric}>{profile.card.brand === 'HUMO' ? 'Humo' : 'Uzcard'} ···· {profile.card.last4}</strong>
                <span className={styles.muted}>{t('sellerProfile.cardAdded', { date: dateOnly(profile.card.addedAt) })}</span>
              </span>
            </div>
          ) : (
            <p className={styles.emptyLine}>{t('sellerProfile.cardNone')}</p>
          )}
          <p className={styles.muted}>{t('sellerProfile.cardText')}</p>
          <p className={styles.note}>{t('sellerProfile.cardPrivacy')}</p>
          {/* Karta qo'shish va almashtirish — FE-07 (balans va pul yechish). */}
          <Link to="/affiliate/balance" className={styles.link}>{profile.card ? t('sellerProfile.cardChange') : t('sellerProfile.cardAdd')}</Link>
        </section>

        <section className={styles.card} aria-labelledby="profile-agreements">
          <header className={styles.head}>
            <h2 id="profile-agreements">{t('sellerProfile.agreementsTitle')}</h2>
            <Link to="/profile/offer" className={styles.link}>{t('sellerProfile.open')}</Link>
          </header>
          <ul className={styles.agreements}>
            <li>
              <FileText aria-hidden />
              <span className={styles.readinessText}>
                <strong>{t('agreements.offerName')}</strong>
                <span className={styles.muted}>{offer ? t('sellerProfile.offerAccepted', { version: offer.version, time: tashkentDateTime(offer.acceptedAt) }) : '—'}</span>
              </span>
            </li>
            <li>
              <FileText aria-hidden />
              <span className={styles.readinessText}>
                <strong>{t('agreements.consentName')}</strong>
                <span className={styles.muted}>{consent ? t('sellerProfile.consentGiven', { time: tashkentDateTime(consent.acceptedAt) }) : '—'}</span>
              </span>
            </li>
          </ul>
          <p className={styles.note}>{t('sellerProfile.agreementsNote')}</p>
        </section>
      </div>

      <EditNameModal open={editing} profile={profile} onClose={() => setEditing(false)} />
    </div>
  );
}

function SecuritySection({ phone }: { phone: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const sessions = useAuthSessionsQuery();
  const revoke = useRevokeAuthSessionMutation();
  const logout = useLogoutMutation();
  const today = tashkentDate();
  const when = (iso: string) => (tashkentDate(new Date(iso)) === today ? t('sellerProfile.today', { time: tashkentClock(new Date(iso)) }) : tashkentDateTime(iso));

  return (
    <section className={styles.card} aria-labelledby="profile-security">
      <header className={styles.head}>
        <h2 id="profile-security">{t('sellerProfile.securityTitle')}</h2>
        <Button icon={<LogOut size={16} />} loading={logout.isPending} onClick={() => logout.mutate()}>{t('sellerProfile.logout')}</Button>
      </header>
      <dl className={styles.fields}>
        <div className={styles.wide}>
          <dt>{t('sellerProfile.loginMethod')}</dt>
          <dd>{t('sellerProfile.loginMethodValue')}</dd>
          <dd className={styles.muted}>{t('sellerProfile.loginMethodText', { phone: formatUzPhone(phone) })}</dd>
        </div>
      </dl>
      {sessions.data ? (
        <>
          <h3 className={styles.subTitle}>{t('sellerProfile.sessions', { count: sessions.data.length })}</h3>
          <ul className={styles.sessions} aria-label={t('sellerProfile.sessions', { count: sessions.data.length })}>
            {sessions.data.map((session) => {
              const device = deviceLabel(session.userAgent);
              return (
                <li key={session.id}>
                  <MonitorSmartphone aria-hidden />
                  <span className={styles.readinessText}>
                    <strong>{device}{session.current ? <Tag className={styles.inlineTag}>{t('sellerProfile.thisDevice')}</Tag> : null}</strong>
                    <span className={styles.muted}>
                      {session.current
                        ? t('sellerProfile.signedIn', { time: when(session.createdAt) })
                        : t('sellerProfile.lastActive', { time: when(session.lastUsedAt ?? session.createdAt) })}
                    </span>
                  </span>
                  {session.current ? null : (
                    <Button
                      size="small"
                      aria-label={t('sellerProfile.closeSessionAria', { device })}
                      loading={revoke.isPending && revoke.variables === session.id}
                      onClick={() =>
                        revoke.mutate(session.id, {
                          onSuccess: () => void message.success(t('sellerProfile.sessionClosed')),
                          onError: (error) => void message.error(getApiErrorMessage(error)),
                        })
                      }
                    >
                      {t('sellerProfile.closeSession')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className={styles.note}>{t('sellerProfile.sessionsNote')}</p>
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
