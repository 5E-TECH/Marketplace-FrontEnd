import { QRCode } from 'antd';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import type { TwoFactorSetup } from '../../../../features/auth/model/authTypes';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../../shared/lib/useMediaQuery';
import { CopyButton } from '../../../../shared/ui/CopyButton/CopyButton';
import { otpauthAccount, secretGroups } from '../../model/twoFactorView';
import styles from './TwoFactor.module.css';

interface KeyStepProps {
  /** `POST /auth/2fa/setup` natijasi; kelguncha — joy egallovchi. */
  setup: TwoFactorSetup | undefined;
  /** QR olinmadi — qadam ichida xabar va «Qayta urinish». */
  failure: ReactNode;
}

function StepHead({ title }: { title: string }) {
  return (
    <div className={styles.stepHead}>
      <span className={styles.stepNumber} aria-hidden>2</span>
      <h2 id="tfa-step-2" className={styles.stepCardTitle}>{title}</h2>
    </div>
  );
}

function Qr({ setup, boxed = true }: { setup: TwoFactorSetup | undefined; boxed?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={boxed ? styles.qrBox : undefined} role="img" aria-label={setup ? t('tfa.qrAria') : t('tfa.qrLoading')} data-testid="tfa-qr">
      {setup ? <QRCode value={setup.otpauthUrl} type="svg" size={152} bordered={false} /> : <div className={styles.qrPlaceholder} />}
    </div>
  );
}

/** Qo'lda kiritish kaliti: to'rtlik guruhlar, sig'masa guruhlar orasida keyingi qatorga; nusxalash tugmasi. */
function SecretKey({ secret, label }: { secret: string; label: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <p id="tfa-key-label" className={styles.keyLabel}>{label}</p>
      <div className={styles.keyBox} role="group" aria-labelledby="tfa-key-label">
        <code className={styles.key} data-testid="tfa-secret">
          {secretGroups(secret).map((group, index) => <Fragment key={index}>{index ? ' ' : null}<span>{group}</span></Fragment>)}
        </code>
        {secret ? <CopyButton text={secret} ariaLabel={t('tfa.keyCopy')} successMessage={t('tfa.keyCopied')} /> : null}
      </div>
    </div>
  );
}

/**
 * Ulashning 2-qadami (umumiy-2fa-ulash). Desktop va planshet: QR va kalit. Telefon (.mobil, holatlar 8): QR ni shu
 * telefon bilan skanerlab bo'lmaydi — «Ilovada ochish» (`otpauth://` havola, ilova hisobni o'zi qo'shadi) va kalit;
 * ilova boshqa telefonda bo'lsa QR ochiladi.
 */
export function KeyStep({ setup, failure }: KeyStepProps) {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [qrOpen, setQrOpen] = useState(false);
  const secret = setup?.secret ?? '';
  const account = setup ? otpauthAccount(setup.otpauthUrl) : '…';

  if (!phone) {
    return (
      <section className={styles.stepCard} aria-labelledby="tfa-step-2">
        <StepHead title={t('tfa.step2Title')} />
        {failure ?? (
          <div className={styles.qrRow}>
            <Qr setup={setup} />
            <div className={styles.qrInfo}>
              <p className={styles.lead}>{t('tfa.step2Text')}</p>
              <p className={styles.account}>{account}</p>
              <SecretKey secret={secret} label={t('tfa.keyLabel')} />
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={styles.stepCard} aria-labelledby="tfa-step-2">
      <StepHead title={t('tfa.step2PhoneTitle')} />
      {failure ?? (
        <>
          <p className={styles.lead}>{t('tfa.step2PhoneText')}</p>
          <a className={styles.openApp} href={setup?.otpauthUrl} aria-disabled={setup ? undefined : true}>
            <ExternalLink aria-hidden />
            {t('tfa.openInApp')}
          </a>
          <p className={styles.accountHint}>{t('tfa.accountInApp')} <strong>{account}</strong></p>
          <SecretKey secret={secret} label={t('tfa.keyLabelPhone')} />
          <div className={styles.qrToggle}>
            <p>{t('tfa.qrOtherPhone')}</p>
            <button type="button" aria-expanded={qrOpen} aria-controls="tfa-qr-panel" onClick={() => setQrOpen((open) => !open)}>
              {qrOpen ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
              {t(qrOpen ? 'tfa.qrHide' : 'tfa.qrShow')}
            </button>
            <div id="tfa-qr-panel" className={styles.qrPanel} hidden={!qrOpen}>
              <Qr setup={setup} boxed={false} />
              <p>{t('tfa.qrOtherPhoneHint')}</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
