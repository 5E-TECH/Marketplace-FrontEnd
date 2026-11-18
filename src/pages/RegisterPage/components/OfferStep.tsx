import { App, Button, Checkbox, ConfigProvider, Skeleton } from 'antd';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { openSession } from '../../../features/auth/api/authApi';
import { useSignInMutation } from '../../../features/auth/api/useLoginMutation';
import { isRegistrationExpired, registerAffiliate, type LegalDocument } from '../../../features/sellerAuth/api/sellerAuthApi';
import { useLegalDocumentQuery } from '../../../features/sellerAuth/api/useLegalDocumentQuery';
import { pendingLoading } from '../../../features/sellerAuth/lib/fieldRules';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { AuthNotice } from '../../../shared/ui/AuthLayout/AuthNotice';
import formStyles from '../../../shared/ui/AuthLayout/authForm.module.css';
import styles from '../RegisterPage.module.css';
import { LegalDocumentModal } from '../../../features/sellerAuth/ui/LegalDocumentModal';

/** Belgi 24 px, burchak 6 (sotuvchi-royxat §3). */
const CHECK_THEME = { components: { Checkbox: { controlInteractiveSize: 24, borderRadiusSM: 6 } } };

interface OfferStepProps {
  registrationToken: string;
  /** Ro'yxat tokeni eskirdi — telefon bosqichiga qaytish. */
  onExpired: () => void;
}

/**
 * 3-qadam: oferta va shaxsiy ma'lumotlarga rozilik (sotuvchi-royxat §3). Ikkalasi
 * belgilanmaguncha tugma yopiq — «Oferta qabul qilinmasa ro‘yxat tugamaydi».
 * Serverga qabul qilingan versiyalar yuboriladi; vaqtni server yozadi.
 */
export function OfferStep({ registrationToken, onExpired }: OfferStepProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const offer = useLegalDocumentQuery('affiliate-offer');
  const consent = useLegalDocumentQuery('personal-data-consent');
  const [accepted, setAccepted] = useState({ offer: false, consent: false });
  const [openDocument, setOpenDocument] = useState<LegalDocument['type'] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const register = useSignInMutation(async (input: { offerVersion: string; consentVersion: string }) => {
    const session = await openSession(await registerAffiliate({ registrationToken, ...input }));
    // Toast bosh sahifada ham ko'rinadi: sessiya ochilishi bilan sahifa almashadi.
    notification.success({
      title: t('register.doneTitle'),
      description: t('register.doneText', { version: input.offerVersion, time: tashkentDateTime() }),
      placement: phone ? 'top' : 'bottomRight',
    });
    return session;
  });

  const ready = accepted.offer && accepted.consent && offer.data && consent.data;

  const submit = () => {
    if (!ready) return;
    setFailure(null);
    register.mutate(
      { offerVersion: offer.data.version, consentVersion: consent.data.version },
      {
        onError: (error) => {
          if (isRegistrationExpired(error)) onExpired();
          else setFailure(getApiErrorMessage(error));
        },
      },
    );
  };

  if (offer.isError || consent.isError) {
    return (
      <div className={formStyles.form}>
        <OfferHeading />
        <AuthNotice tone="danger" title={t('register.docError')}>
          <Button
            onClick={() => {
              void offer.refetch();
              void consent.refetch();
            }}
          >
            {t('otp.retry')}
          </Button>
        </AuthNotice>
      </div>
    );
  }

  return (
    <form
      className={formStyles.form}
      aria-labelledby="register-title"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <OfferHeading />

      {offer.data ? (
        <div className={styles.offerBox}>
          <div className={styles.offerHead}>
            <FileText size={20} aria-hidden />
            <div className={styles.offerName}>
              <p>{t('register.offerDoc')}</p>
              <p>{t('register.version', { version: offer.data.version })}</p>
            </div>
            <button type="button" className={formStyles.linkButton} onClick={() => setOpenDocument('affiliate-offer')}>
              {t('register.fullText')}
            </button>
          </div>
          <div className={styles.offerSummary}>
            <p>{t('register.summaryTitle')}</p>
            <dl>
              {offer.data.summary.map((item) => (
                <div key={item.term}>
                  <dt>{item.term}</dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : (
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      )}

      <ConfigProvider theme={CHECK_THEME}>
        <div className={styles.checks}>
          <Checkbox
            className={styles.check}
            checked={accepted.offer}
            disabled={!offer.data}
            onChange={(event) => setAccepted((current) => ({ ...current, offer: event.target.checked }))}
          >
            {t('register.acceptOffer')}
          </Checkbox>
          <Checkbox
            className={styles.check}
            checked={accepted.consent}
            disabled={!consent.data}
            onChange={(event) => setAccepted((current) => ({ ...current, consent: event.target.checked }))}
          >
            {t('register.acceptConsent')} <span className={styles.dot}>·</span>{' '}
            <button
              type="button"
              className={formStyles.linkButton}
              onClick={(event) => {
                event.preventDefault();
                setOpenDocument('personal-data-consent');
              }}
            >
              {t('register.consentLink')}
            </button>
          </Checkbox>
        </div>
      </ConfigProvider>

      {failure ? <AuthNotice tone="danger" title={t('login.failedTitle')} text={failure} /> : null}

      <div className={formStyles.actions}>
        <Button className={formStyles.submit} type="primary" htmlType="submit" block disabled={!ready} loading={pendingLoading(register.isPending)}>
          {register.isPending ? t('register.submitting') : t('register.submit')}
        </Button>
        {ready || register.isPending ? null : <p className={formStyles.caption}>{t('register.mustAccept')}</p>}
      </div>

      <LegalDocumentModal
        document={openDocument === 'affiliate-offer' ? offer.data ?? null : openDocument === 'personal-data-consent' ? consent.data ?? null : null}
        onClose={() => setOpenDocument(null)}
        onAccept={(type) => {
          setAccepted((current) => (type === 'affiliate-offer' ? { ...current, offer: true } : { ...current, consent: true }));
          setOpenDocument(null);
        }}
      />
    </form>
  );
}

function OfferHeading() {
  const { t } = useTranslation();
  return (
    <div className={formStyles.lead}>
      <h1 id="register-title" className={formStyles.title}>{t('register.offerTitle')}</h1>
      <p>{t('register.offerLead')}</p>
    </div>
  );
}
