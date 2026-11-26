import { App, Button, Checkbox, ConfigProvider } from 'antd';
import { ArrowRight, Copy, Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { openSession } from '../../../../features/auth/api/authApi';
import { formatRecoveryCode } from '../../../../features/auth/api/twoFactorApi';
import { useSignInMutation } from '../../../../features/auth/api/useLoginMutation';
import type { TwoFactorChallenge } from '../../../../features/auth/model/authTypes';
import { pendingLoading } from '../../../../features/sellerAuth/lib/fieldRules';
import { saveBlob } from '../../../../shared/api/download';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import { BRAND } from '../../../../shared/config/brand';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { formatUzPhone } from '../../../../shared/lib/phone';
import { printPlainText } from '../../../../shared/lib/printText';
import { tashkentDateTime } from '../../../../shared/lib/tashkentTime';
import { useLeaveGuard } from '../../../../shared/lib/useLeaveGuard';
import { AuthNotice } from '../../../../shared/ui/AuthLayout/AuthNotice';
import authStyles from '../../../../shared/ui/AuthLayout/authForm.module.css';
import { identityLine, recoveryCodesText } from '../../model/twoFactorView';
import type { EnabledTwoFactor } from './ConnectApp';
import { SaveCodesDialog } from './SaveCodesDialog';
import styles from './TwoFactor.module.css';

/** Belgi 20 px, burchak 6 (umumiy-2fa-ulash.holatlar 2). */
const CHECK_THEME = { components: { Checkbox: { controlInteractiveSize: 20, borderRadiusSM: 6 } } };
const FILE_NAME = `${BRAND.name.toLowerCase().replace(/\s+/g, '-')}-2fa-zaxira-kodlar.txt`;

/**
 * «Zaxira kodlarni saqlang» (umumiy-2fa-ulash.holatlar 2, TZ T8): ilova ulangach bir martalik kodlar (BE-26: faqat
 * `enable` javobida, keyin qayta ko'rsatilmaydi) — yuklab olish, nusxalash, chop etish. Sessiya «Panelga o'tish» da
 * ochiladi; belgi qo'yilmagan bo'lsa — «Kodlarni saqladingizmi?». Sahifani yopish yoki yangilashda brauzer so'raydi.
 */
export function RecoveryCodes({ challenge, enabled }: { challenge: TwoFactorChallenge; enabled: EnabledTwoFactor }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const finish = useSignInMutation(openSession);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useLeaveGuard(!finish.isSuccess);

  const { recoveryCodes: codes } = enabled;
  const fileText = () => recoveryCodesText({
    codes,
    title: t('tfa.fileTitle', { brand: BRAND.name }),
    account: t('tfa.fileAccount', { account: challenge.user ? `${identityLine(challenge, t)} (${formatUzPhone(challenge.phone)})` : formatUzPhone(challenge.phone) }),
    date: t('tfa.fileDate', { date: tashkentDateTime() }),
    rule: t('tfa.fileRule'),
  });

  const download = () => saveBlob(new Blob([fileText()], { type: 'text/plain;charset=utf-8' }), FILE_NAME);
  const copy = () => {
    navigator.clipboard.writeText(fileText()).then(
      () => void message.success(t('tfa.codesCopied')),
      () => void message.error(t('copy.failed')),
    );
  };
  const print = () => printPlainText(t('tfa.fileTitle', { brand: BRAND.name }), fileText());

  const goToPanel = () => {
    setNotice(null);
    finish.mutate(enabled.login, {
      onSuccess: () => void message.success(t('auth.loginSuccess')),
      onError: (error) => setNotice(getApiErrorMessage(error)),
    });
  };

  return (
    <div className={`${authStyles.form} ${styles.wide}`} data-testid="tfa-recovery-codes">
      <AuthNotice tone="success" title={t('tfa.enabledTitle')} text={t('tfa.enabledText')} />
      <div className={styles.heading}>
        <h1 id="tfa-title" className={authStyles.title}>{t('tfa.codesTitle')}</h1>
        <p className={styles.lead}>{t('tfa.codesText')}</p>
      </div>
      <ol className={styles.codes} aria-label={t('tfa.codesList')}>
        {codes.map((code, index) => (
          <li key={code}>
            <span aria-hidden>{index + 1}</span>
            <code>{formatRecoveryCode(code)}</code>
          </li>
        ))}
      </ol>
      <div className={styles.tools}>
        <button type="button" className={styles.tool} onClick={download}><Download aria-hidden />{t('tfa.codesDownload')}</button>
        <button type="button" className={styles.tool} onClick={copy}><Copy aria-hidden />{t('tfa.codesCopy')}</button>
        <button type="button" className={styles.tool} onClick={print}><Printer aria-hidden />{t('tfa.codesPrint')}</button>
      </div>
      <ConfigProvider theme={CHECK_THEME}>
        <Checkbox className={styles.saved} checked={saved} onChange={(event) => setSaved(event.target.checked)}>
          {t('tfa.codesSaved')}
        </Checkbox>
      </ConfigProvider>
      {notice ? <AuthNotice tone="danger" title={t('tfa.failedTitle')} text={notice} /> : null}
      <Button
        className={authStyles.submit}
        type="primary"
        block
        icon={<ArrowRight size={18} aria-hidden />}
        iconPlacement="end"
        loading={pendingLoading(finish.isPending)}
        onClick={() => (saved ? goToPanel() : setConfirmOpen(true))}
      >
        {t('tfa.toPanel')}
      </Button>
      {confirmOpen ? (
        <SaveCodesDialog
          onBack={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            setSaved(true);
            goToPanel();
          }}
        />
      ) : null}
    </div>
  );
}
