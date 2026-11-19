import { useQueryClient } from '@tanstack/react-query';
import { App, Form } from 'antd';
import axios from 'axios';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store/hooks';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { initials } from '../../../../shared/lib/initials';
import { shortPersonName } from '../../../../shared/lib/personName';
import { formatUzPhone, normalizeUzPhone } from '../../../../shared/lib/phone';
import { PasswordInput } from '../../../../shared/ui/PasswordInput/PasswordInput';
import { SheetModal } from '../../../../shared/ui/SheetModal/SheetModal';
import { authenticate } from '../../api/authApi';
import { ROLE_LABEL_KEYS } from '../../lib/roleLabels';
import { authenticated, currentUserLoaded, loggedOut, selectAuthUser, sessionRestored } from '../../model/authSlice';
import type { AuthSession } from '../../model/authTypes';
import { SessionActions, SessionPrimary } from './SessionActions';
import { SessionSmsForm } from './SessionSmsForm';
import styles from './SessionExpiredDialog.module.css';

interface SessionExpiredDialogProps {
  /** Ochiq bo'lim nomi — «Panel: Ish joyi». */
  panelName: string;
}

/**
 * Sessiya tugadi — joyida qayta kirish (umumiy-sessiya: asosiy ko'rinish, holatlar 1–2; FE-02). Sahifa yopilmaydi:
 * forma va belgilar joyida qoladi, kirgach shu yerdan davom etiladi (holatlar 5).
 * Xodim — parol; sotuvchi va optovik — SMS kod (FE-04). Admin 2FA qadami — FE-27.
 */
export function SessionExpiredDialog({ panelName }: SessionExpiredDialogProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const user = useAppSelector(selectAuthUser);
  const [form] = Form.useForm<{ password: string }>();
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;
  const roleLabel = t(ROLE_LABEL_KEYS[user.role]);
  const name = user.name.trim() ? shortPersonName(user.name) : formatUzPhone(user.phone);

  const sms = user.role === 'AFFILIATE' || user.role === 'WHOLESALER';

  /** Shu odam — sahifa joyida davom etadi; boshqa hisob — odatdagi kirishdek, oldingi ma'lumot qolmaydi. */
  const restore = (session: AuthSession) => {
    if (session.user?.id === user.id) {
      dispatch(sessionRestored({ accessToken: session.accessToken }));
      dispatch(currentUserLoaded(session.user));
      // Sessiya tugagan paytda yiqilgan so'rovlar qayta yuboriladi; sahifa holati joyida.
      void queryClient.invalidateQueries();
      void message.success(t('session.restored'), 4);
    } else {
      queryClient.clear();
      dispatch(authenticated({ accessToken: session.accessToken }));
    }
  };

  const signIn = async ({ password }: { password: string }) => {
    setSubmitting(true);
    try {
      restore(await authenticate({ phone: normalizeUzPhone(user.phone), password }));
    } catch (error) {
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
            <p id="session-expired-text">{sms ? t('session.expiredTextSms') : t('session.expiredText')}</p>
          </div>
        </div>
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
          <SessionSmsForm phone={user.phone} onSignedIn={restore} onSignOut={signOut} />
        ) : (
          <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => void signIn(values)} className={styles.form}>
            <Form.Item name="password" label={t('auth.password')} rules={[{ required: true, message: t('auth.passwordRequired') }]}>
              <PasswordInput autoComplete="current-password" autoFocus maxLength={128} />
            </Form.Item>
            <SessionActions onSignOut={signOut}>
              <SessionPrimary submit busy={submitting}>{t('session.signIn')}</SessionPrimary>
            </SessionActions>
          </Form>
        )}
      </div>
    </SheetModal>
  );
}
