import { App, Form } from 'antd';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../../features/auth/api/useLoginMutation';
import type { TwoFactorChallenge } from '../../features/auth/model/authTypes';
import { authStorage } from '../../features/auth/lib/authStorage';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { normalizeUzPhone } from '../../shared/lib/phone';
import { LoginForm, type LoginFormValues, type LoginNotice } from './components/LoginForm/LoginForm';
import { LoginMethods } from './components/LoginMethods/LoginMethods';
import { RoleSwitch, type LoginMode } from './components/RoleSwitch/RoleSwitch';
import { SellerLoginForm } from './components/SellerLoginForm/SellerLoginForm';
import { TwoFactorCodeStep } from './components/TwoFactor/TwoFactorCodeStep';
import { TwoFactorSetupFlow } from './components/TwoFactor/TwoFactorSetupFlow';
import type { TwoFactorLeave } from './model/twoFactorView';
import { AuthLayout } from '../../shared/ui/AuthLayout/AuthLayout';

/**
 * Tizimga kirish (umumiy-kirish). Desktop: chapda navy «Kirish usuli», o'ngda forma;
 * telefon: navy sarlavha, forma, ostida usullar. «Kim sifatida kirasiz»: sotuvchi va
 * optovik — SMS kod (FE-04), platforma xodimi — telefon va parol (FE-01); admin, superadmin
 * va moliya — parol va ilovadagi kod (FE-27, umumiy-2fa).
 */
export default function LoginPage() {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const [form] = Form.useForm<LoginFormValues>();
  const [notice, setNotice] = useState<LoginNotice | null>(null);
  const [mode, setMode] = useState<LoginMode>('seller');
  // FE-27: parol tekshirilgach 2FA bosqichi (BE-26).
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);
  // Foydalanuvchi tanlovni almashtirgan — yangi formadagi tanlov fokusni saqlaydi.
  const [modeChanged, setModeChanged] = useState(false);

  useEffect(() => {
    const state: unknown = location.state as unknown;
    const locationNotice = typeof state === 'object' && state !== null && 'notice' in state && typeof state.notice === 'string'
      ? state.notice
      : null;
    const pendingNotice = locationNotice ?? authStorage.consumeNotice();
    if (pendingNotice) {
      void message.success(pendingNotice);
      if (locationNotice) void navigate('/login', { replace: true, state: null });
    }
  }, [location.state, message, navigate]);

  const showError = (error: unknown) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    // Parol xato yoki raqam ro'yxatda yo'q — bir xil matn: hisob borligi oshkor qilinmaydi.
    if (status === 401) {
      form.setFields([{ name: 'password', errors: [t('login.invalidCredentials')] }]);
      return;
    }
    if (status === 429) {
      setNotice({ tone: 'warning', title: t('login.tooManyTitle'), text: t('login.tooManyText') });
      return;
    }
    if (status === undefined || status >= 500) {
      setNotice({ tone: 'danger', title: t('login.serverTitle'), text: t('login.serverText') });
      return;
    }
    setNotice({ tone: 'danger', title: t('login.failedTitle'), text: getApiErrorMessage(error) });
  };

  const handleSubmit = (values: LoginFormValues) => {
    setNotice(null);
    loginMutation.mutate(
      { phone: normalizeUzPhone(values.phone), password: values.password },
      {
        onSuccess: (result) => {
          // BE-26: admin, superadmin, moliya — sessiya o'rniga ilovadagi kod (yoki birinchi ulash).
          if (result.kind === 'challenge') {
            setChallenge(result.challenge);
            return;
          }
          void message.success(t('auth.loginSuccess'));
        },
        onError: showError,
      },
    );
  };

  /**
   * 2FA dan parol bosqichiga: «Boshqa hisob»/«Chiqish» — bo'sh forma; muddat o'tgan yoki 2FA boshqa joyda ulangan —
   * raqam qoladi, sabab ko'rsatiladi.
   */
  const leaveTwoFactor = useCallback((reason: TwoFactorLeave) => {
    setChallenge(null);
    form.setFieldsValue({ password: '' });
    if (reason === 'signOut') {
      form.resetFields();
      setNotice(null);
      return;
    }
    setNotice(reason === 'expired'
      ? { tone: 'warning', title: t('tfa.expiredTitle'), text: t('tfa.expiredText') }
      : { tone: 'warning', title: t('tfa.alreadyEnabledTitle'), text: t('tfa.alreadyEnabledText') });
  }, [form, t]);

  const roleSwitch = (
    <RoleSwitch
      value={mode}
      keepFocus={modeChanged}
      onChange={(next) => {
        setMode(next);
        setModeChanged(true);
      }}
    />
  );
  // Ro'yxatdan «Kirishga o‘tish» — raqam qayta kiritilmaydi.
  const routeState: unknown = location.state as unknown;
  const initialPhone = typeof routeState === 'object' && routeState !== null && 'phone' in routeState && typeof routeState.phone === 'string'
    ? routeState.phone
    : undefined;

  if (challenge?.setupRequired) return <TwoFactorSetupFlow key={challenge.token} challenge={challenge} onLeave={leaveTwoFactor} />;
  if (challenge) {
    return (
      <AuthLayout centered renderAside={(tone, brand) => <LoginMethods tone={tone} brand={brand} active="admin" />}>
        <TwoFactorCodeStep key={challenge.token} challenge={challenge} onLeave={leaveTwoFactor} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout centered renderAside={(tone, brand) => <LoginMethods tone={tone} brand={brand} active={mode} />}>
      {mode === 'seller' ? (
        <SellerLoginForm roleSwitch={roleSwitch} initialPhone={initialPhone} />
      ) : (
        <LoginForm
          form={form}
          isSubmitting={loginMutation.isPending}
          notice={notice}
          onSubmit={handleSubmit}
          onChange={() => setNotice(null)}
          roleSwitch={roleSwitch}
        />
      )}
    </AuthLayout>
  );
}
