import { App, Button } from 'antd';
import { Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../../app/store/hooks';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import {
  impersonationEndHandled,
  impersonationEnded,
  selectImpersonation,
  selectImpersonationEnd,
} from '../../model/authSlice';
import styles from './ImpersonationBanner.module.css';

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * "Nomidan kirish" paytida doim ko'rinadigan ogohlantirish: kim nomidan,
 * qancha vaqt qolgani va chiqish tugmasi. Token 15 daqiqada tugaydi va
 * refresh qilinmaydi — muddat tugashi bilan admin sessiyasiga va sahifasiga
 * qaytiladi.
 */
export function ImpersonationBanner() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const returnRequested = useRef(false);
  const impersonation = useAppSelector(selectImpersonation);
  const ended = useAppSelector(selectImpersonationEnd);
  const [now, setNow] = useState(() => Date.now());
  const expiresAt = impersonation ? Date.parse(impersonation.expiresAt) : 0;

  useEffect(() => {
    if (!impersonation) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [impersonation]);

  useEffect(() => {
    if (impersonation && now >= expiresAt) dispatch(impersonationEnded('expired'));
  }, [dispatch, expiresAt, impersonation, now]);

  // Router manzilni transition bilan yangilaydi: qaytish sahifasi (lazy) yuklanguncha
  // eski sahifa ko'rinib turadi va o'z yo'naltirishini qilishi mumkin. Shuning uchun
  // hodisa router haqiqatan yangi manzilga o'tgandan keyingina yopiladi.
  useEffect(() => {
    if (!ended) {
      returnRequested.current = false;
      return;
    }
    if (!returnRequested.current) {
      returnRequested.current = true;
      void navigate(ended.returnTo, { replace: true });
      return;
    }
    dispatch(impersonationEndHandled());
    if (ended.reason === 'expired') void message.warning(t('admin.impersonation.expired'));
    else void message.info(t('admin.impersonation.ended'));
  }, [dispatch, ended, location, message, navigate, t]);

  if (!impersonation) return null;

  const remaining = formatRemaining(expiresAt - now);
  return (
    <div className={styles.banner} role="alert" data-testid="impersonation-banner">
      <Eye aria-hidden />
      <span className={styles.text}>{t('admin.impersonation.viewingAs', { name: impersonation.user.name })}</span>
      <span className={styles.timer} title={t('admin.impersonation.remaining', { time: remaining })}>{remaining}</span>
      <Button size="small" onClick={() => dispatch(impersonationEnded('exited'))}>
        {t('admin.impersonation.exit')}
      </Button>
    </div>
  );
}
