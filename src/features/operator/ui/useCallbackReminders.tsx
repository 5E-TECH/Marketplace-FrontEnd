import { App, Button } from 'antd';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import type { OperatorLead } from '../api/operatorApi';
import { CALLBACK_GRACE_MINUTES, REMINDER_MINUTES } from '../lib/leadRules';

const MINUTE = 60_000;
const STORAGE_KEY = 'elchi.operator.reminded';

function readReminded(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

const reminded = readReminded();

function remember(key: string) {
  reminded.add(key);
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...reminded].slice(-50))); } catch { /* faqat xotirada */ }
}

/** Brauzer eslatmasi ruxsati: «Yoqish» tugmasi va holat matni uchun. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported';
}

/**
 * 8-qoida: rejalashtirilgan qo'ng'iroqdan 5 daqiqa oldin eslatma — ilova ichida toast
 * (o'ng pastda, amalli) va boshqa oynada bo'lsa brauzer xabari (operator-rejalashtirilgan 3).
 * Har qo'ng'iroq uchun bir marta (sessiya davomida).
 */
export function useCallbackReminders(leads: OperatorLead[] | undefined, now: number) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const navigate = useNavigate();

  useEffect(() => {
    for (const lead of leads ?? []) {
      if (lead.status !== 'CALLBACK' || !lead.callbackAt) continue;
      const at = Date.parse(lead.callbackAt);
      const key = `${lead.id}@${lead.callbackAt}`;
      if (reminded.has(key) || now < at - REMINDER_MINUTES * MINUTE || now > at + CALLBACK_GRACE_MINUTES * MINUTE) continue;
      remember(key);
      const title = t('opc.reminderTitle', { time: tashkentClock(at), name: lead.customerName });
      const description = t('opc.reminderText', { lead: lead.id, product: lead.productName });
      notification.info({
        key,
        title,
        description,
        placement: 'bottomRight',
        duration: 6,
        actions: <Button type="primary" size="small" onClick={() => { notification.destroy(key); void navigate('/operator'); }}>{t('opc.goWorkspace')}</Button>,
      });
      if (notificationPermission() === 'granted' && document.visibilityState !== 'visible') {
        try { new window.Notification(title, { body: description, tag: key }); } catch { /* ba'zi brauzerlar faqat service worker orqali */ }
      }
    }
  }, [leads, navigate, notification, now, t]);
}
