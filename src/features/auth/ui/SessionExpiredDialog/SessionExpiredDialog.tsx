import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Form, Modal } from 'antd';
import axios from 'axios';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../app/store/hooks';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { initials } from '../../../../shared/lib/initials';
import { normalizeUzPhone } from '../../../../shared/lib/phone';
import { PasswordInput } from '../../../../shared/ui/PasswordInput/PasswordInput';
import { authenticate } from '../../api/authApi';
import { ROLE_LABEL_KEYS } from '../../lib/roleLabels';
import { authenticated, currentUserLoaded, loggedOut, selectAuthUser, sessionRestored } from '../../model/authSlice';
import styles from './SessionExpiredDialog.module.css';

interface SessionExpiredDialogProps {
  /** Ochiq bo'lim nomi — «Panel: Ish joyi». */
  panelName: string;
}

/**
 * Sessiya tugadi — joyida qayta kirish (umumiy-sessiya §1, FE-02). Sahifa yopilmaydi:
 * forma va belgilar joyida qoladi, kirgach shu yerdan davom etiladi (§2).
 * Xodim — parol; sotuvchi SMS kodi (FE-04, BE-06) va admin 2FA qadami (FE-27) keyin.
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

  const signIn = async ({ password }: { password: string }) => {
    setSubmitting(true);
    try {
      const session = await authenticate({ phone: normalizeUzPhone(user.phone), password });
      if (session.user?.id === user.id) {
        dispatch(sessionRestored({ accessToken: session.accessToken }));
        dispatch(currentUserLoaded(session.user));
        // Sessiya tugagan paytda yiqilgan so'rovlar qayta yuboriladi; sahifa holati joyida.
        void queryClient.invalidateQueries();
        void message.success(t('session.restored'), 4);
      } else {
        // Boshqa hisob (yoki tanilmagan rol) — odatdagi kirishdek, oldingi shaxs ma'lumoti qolmaydi.
        queryClient.clear();
        dispatch(authenticated({ accessToken: session.accessToken }));
      }
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
    <Modal
      open
      width={440}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
      title={t('session.expiredTitle')}
      aria-describedby="session-expired-text"
    >
      <div data-testid="session-expired">
        <p id="session-expired-text" className={styles.text}>{t('session.expiredText')}</p>
        <div className={styles.who}>
          <span className={styles.avatar} aria-hidden>{initials(user.name)}</span>
          <span>
            <strong>{user.name}</strong> · {roleLabel}
            <span className={styles.panel}>{t('session.panel', { name: panelName })}</span>
          </span>
        </div>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => void signIn(values)} className={styles.form}>
          <Form.Item name="password" label={t('auth.password')} rules={[{ required: true, message: t('auth.passwordRequired') }]}>
            <PasswordInput autoComplete="current-password" autoFocus maxLength={128} />
          </Form.Item>
          <div className={styles.actions}>
            <Button onClick={signOut}>{t('session.logout')}</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>{t('session.signIn')}</Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
}
