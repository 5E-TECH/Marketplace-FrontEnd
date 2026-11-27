import { useQueryClient } from '@tanstack/react-query';
import { App, Form } from 'antd';
import axios from 'axios';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../../app/store/hooks';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { initials } from '../../../../shared/lib/initials';
import { shortPersonName } from '../../../../shared/lib/personName';
import { formatUzPhone, normalizeUzPhone } from '../../../../shared/lib/phone';
import { PasswordInput } from '../../../../shared/ui/PasswordInput/PasswordInput';
import { SheetModal } from '../../../../shared/ui/SheetModal/SheetModal';
import { authenticate } from '../../api/authApi';
import { lockAccountOf, readAccountLock } from '../../lib/accountLock';
import { ROLE_LABEL_KEYS } from '../../lib/roleLabels';
import { TwoFactorRequiredError } from '../../lib/twoFactorRequiredError';
import { accountLocked, authenticated, currentUserLoaded, loggedOut, selectAuthUser, sessionRestored } from '../../model/authSlice';
import type { AuthSession, TwoFactorChallenge } from '../../model/authTypes';
import { SessionActions, SessionPrimary } from './SessionActions';
import { SessionSmsForm } from './SessionSmsForm';
import { SessionTwoFactorStep } from './SessionTwoFactorStep';
import styles from './SessionExpiredDialog.module.css';

interface SessionExpiredDialogProps {
  /** Ochiq bo'lim nomi — «Panel: Ish joyi». */
  panelName: string;
}

/**
 * Sessiya tugadi — joyida qayta kirish (umumiy-sessiya: asosiy ko'rinish, holatlar 1–2; FE-02). Sahifa yopilmaydi:
 * forma va belgilar joyida qoladi, kirgach shu yerdan davom etiladi (holatlar 5).
 * Xodim — parol; sotuvchi va optovik — SMS kod (FE-04); admin, superadmin va moliya — parol, keyin ilovadagi kod
 * (holatlar 3, 12). Kirishda hisob bloklangani ma'lum bo'lsa — «Hisobingiz bloklandi» oynasi (FE-15).
 */
export function SessionExpiredDialog({ panelName }: SessionExpiredDialogProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppSelector(selectAuthUser);
  const [form] = Form.useForm<{ password: string }>();
  const [submitting, setSubmitting] = useState(false);
  // Parol to'g'ri, endi ilovadagi kod (BE-26).
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  // 2FA bosqichi muddati o'tdi (5 daqiqa) — parol qayta so'raladi.
  const [passwordNote, setPasswordNote] = useState<string | null>(null);

  if (!user) return null;
  const roleLabel = t(ROLE_LABEL_KEYS[user.role]);
  const name = user.name.trim() ? shortPersonName(user.name) : formatUzPhone(user.phone);

  const sms = user.role === 'AFFILIATE' || user.role === 'WHOLESALER';

  /** Shu odam — sahifa joyida davom etadi; boshqa hisob — odatdagi kirishdek, oldingi ma'lumot qolmaydi. */
  const restore = (session: AuthSession) => {
    if (session.user?.id === user.id) {
      dispatch(sessionRestored({ accessToken: session.accessToken }));
      dispatch(currentUserLoaded(session.user));
      // Roli o'zgargan — eski sahifa o'rniga «Rolingiz o‘zgardi» (ProtectedRoute), keshni u tozalaydi.
      if (session.user.role !== user.role) return;
      // Sessiya tugagan paytda yiqilgan so'rovlar qayta yuboriladi; sahifa holati joyida.
      void queryClient.invalidateQueries();
      void message.success(t('session.restored'), 4);
    } else {
      queryClient.clear();
      dispatch(authenticated({ accessToken: session.accessToken }));
    }
  };

  /** Kirishda hisob yopilgani ma'lum bo'ldi (backend: «Hisobingiz bloklangan»; taklif `errorCode`). */
  const lockFrom = (error: unknown) => {
    const lock = readAccountLock(error, lockAccountOf(user));
    if (lock) dispatch(accountLocked(lock));
    return lock !== null;
  };

  const signIn = async ({ password }: { password: string }) => {
    setSubmitting(true);
    try {
      restore(await authenticate({ phone: normalizeUzPhone(user.phone), password }));
    } catch (error) {
      if (error instanceof TwoFactorRequiredError) {
        // Superadmin 2FA ni tiklagan (FE-15 TC5): ilovani qayta ulash — kirish sahifasidagi to'liq oqim (QR, zaxira
        // kodlar) shu bosqich bilan davom etadi, ulangach shu sahifaga qaytiladi.
        // Tokenlar allaqachon yo'q (`sessionExpired`), shuning uchun kirish sahifasi ochiladi; `loggedOut` bu yerda
        // chaqirilmaydi — aks holda ProtectedRoute o'z yo'naltirishi bilan `challenge` ni bosib ketadi.
        if (error.challenge.setupRequired) {
          void navigate('/login', { replace: true, state: { from: location, challenge: error.challenge } });
          return;
        }
        setChallenge(error.challenge);
        return;
      }
      if (lockFrom(error)) return;
      const invalid = axios.isAxiosError(error) && error.response?.status === 401;
      form.setFields([{ name: 'password', errors: [invalid ? t('login.invalidCredentials') : getApiErrorMessage(error)] }]);
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = () => {
    queryClient.clear();
    dispatch(loggedOut({ manual: true }));
  };

  return (
    <SheetModal
      open
      width={480}
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={null}
      title={t('session.expiredTitle')}
      rootClassName={styles.root}
      aria-describedby="session-expired-text"
    >
      <div className={styles.dialog} data-testid="session-expired">
        <div className={styles.head}>
          <span className={styles.icon} aria-hidden><Lock /></span>
          <div className={styles.headText}>
            <h3>{t('session.expiredTitle')}</h3>
            <p id="session-expired-text">{challenge ? t('session.tfaText') : sms ? t('session.expiredTextSms') : t('session.expiredText')}</p>
          </div>
        </div>
        {challenge ? (
          <SessionTwoFactorStep
            challenge={challenge}
            who={{ initials: initials(user.name), name, role: roleLabel }}
            onBack={(expired) => {
              setChallenge(null);
              setPasswordNote(expired ? t('tfa.expiredText') : null);
            }}
            onSignedIn={restore}
            onLocked={lockFrom}
          />
        ) : (
          <>
            <div className={styles.who}>
              <span className={styles.avatar} aria-hidden>{initials(user.name)}</span>
              <span className={styles.whoText}>
                <span className={styles.whoName}>
                  {name} <span className={styles.whoRole}>· {roleLabel}</span>
                </span>
                <span className={styles.panel}>{t('session.panel', { name: panelName })}</span>
              </span>
            </div>
            {sms ? (
              <SessionSmsForm phone={user.phone} onSignedIn={restore} onSignOut={signOut} onLocked={lockFrom} />
            ) : (
              <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => void signIn(values)} onValuesChange={() => setPasswordNote(null)} className={styles.form}>
                <Form.Item
                  name="password"
                  label={t('auth.password')}
                  rules={[{ required: true, message: t('auth.passwordRequired') }]}
                  validateStatus={passwordNote ? 'warning' : undefined}
                  help={passwordNote ?? undefined}
                >
                  <PasswordInput autoComplete="current-password" autoFocus maxLength={128} />
                </Form.Item>
                <SessionActions onSignOut={signOut}>
                  <SessionPrimary submit busy={submitting}>{t('session.signIn')}</SessionPrimary>
                </SessionActions>
              </Form>
            )}
          </>
        )}
      </div>
    </SheetModal>
  );
}
