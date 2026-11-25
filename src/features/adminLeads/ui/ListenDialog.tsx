import { App } from 'antd';
import { Download, Headphones, Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { tashkentClock, tashkentDay } from '../../../shared/lib/tashkentTime';
import { AudioPlayer } from '../../../shared/ui/AudioPlayer/AudioPlayer';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import type { LeadStatus } from '../../operator/model/operatorTypes';
import type { AdminLeadAttempt } from '../model/adminLeadTypes';
import styles from './LeadDialogs.module.css';

interface ListenDialogProps {
  lead: { id: string; customerName: string; productName: string; status: LeadStatus };
  attempt: AdminLeadAttempt;
  /** Urinish tartib raqami (1 dan). */
  number: number;
  /** Yuklab olish — faqat admin (TEL-7: nazoratchi tinglaydi, yuklab olmaydi). */
  canDownload: boolean;
  onClose: () => void;
}

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const mmss = (seconds: number | null) => (seconds ? clock(seconds) : '—');
const keptUntil = (attempt: AdminLeadAttempt) => attempt.keptUntil ?? new Date(Date.parse(attempt.at) + 90 * 86_400_000).toISOString();

/**
 * «Qo'ng'iroq yozuvi» (admin-lid-karta «Tinglash»): pleyer, ogohlantirish, kanal, kim tugatdi; tinglash audit jurnaliga.
 * «Yuklab olish» — faqat admin, alohida tasdiq bilan (mijoz ovozi — shaxsiy ma'lumot), har yuklab olish auditga.
 */
export function ListenDialog({ lead, attempt, number, canDownload, onClose }: ListenDialogProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [confirm, setConfirm] = useState(false);
  const kept = tashkentDay(keptUntil(attempt));
  const label = t('alk.dl.recordingValue', { id: lead.id, n: number, duration: mmss(attempt.durationSeconds) });

  const download = () => {
    if (!attempt.recordingUrl) return;
    const link = document.createElement('a');
    link.href = attempt.recordingUrl;
    link.download = `${lead.id}-${number}.wav`;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    notification.success({ title: t('alk.dl.done'), description: t('alk.dl.doneText', { id: lead.id, n: number }), placement: phone ? 'top' : 'bottomRight', duration: 4 });
    setConfirm(false);
  };

  if (confirm) {
    return (
      <Dialog
        open
        title={t('alk.dl.title')}
        description={t('alk.dl.desc')}
        icon={<Download />}
        tone="warning"
        onClose={() => setConfirm(false)}
        testId="download-dialog"
        footer={(
          <>
            <DialogCancel onClick={() => setConfirm(false)}>{t('al.cancel')}</DialogCancel>
            <DialogPrimary onClick={download} shortcut={false} icon={<Download />}>{t('alk.dl.submit')}</DialogPrimary>
          </>
        )}
      >
        <div className={styles.body} role="alertdialog" aria-label={t('alk.dl.title')}>
          <dl className={styles.facts}>
            <div><dt>{t('alk.dl.recording')}</dt><dd>{label}</dd></div>
            <div><dt>{t('alk.dl.kept')}</dt><dd>{t('alk.dl.keptValue', { date: kept })}</dd></div>
          </dl>
          <p className={styles.hint}><ShieldCheck aria-hidden />{t('alk.dl.audit')}</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      title={t('alk.li.title')}
      description={t('alk.li.desc', { id: lead.id, product: lead.productName, status: t(`status.lead.${lead.status}`) })}
      icon={<Headphones />}
      width={560}
      onClose={onClose}
      testId="listen-dialog"
      footer={<DialogCancel onClick={onClose}>{t('alk.li.close')}</DialogCancel>}
    >
      <div className={styles.body}>
        <AudioPlayer
          src={attempt.recordingUrl ?? null}
          unavailable={attempt.recordingUrl ? undefined : 'missing'}
          title={t('alk.li.player', { id: lead.id, name: lead.customerName })}
          subtitle={t('alk.li.playerSub', { operator: attempt.operatorName, time: tashkentClock(Date.parse(attempt.at)), n: number, duration: mmss(attempt.durationSeconds) })}
          keptUntil={t('alk.li.kept', { date: kept })}
        />
        <dl className={styles.facts}>
          {attempt.notice ? <div><dt>{t('alk.li.notice')}</dt><dd>{t('alk.li.noticeValue', { from: clock(attempt.notice.from), to: clock(attempt.notice.to) })}</dd></div> : null}
          {attempt.channel ? <div><dt>{t('alk.li.channel')}</dt><dd>{t('alk.li.channelValue', { channel: attempt.channel })}</dd></div> : null}
          {attempt.endedBy ? <div><dt>{t('alk.li.ended')}</dt><dd>{t(`alk.li.ended.${attempt.endedBy}`)}</dd></div> : null}
        </dl>
        <div className={styles.downloadRow}>
          <p className={styles.hint}><Lock aria-hidden />{t('alk.li.downloadAdmin')}</p>
          {canDownload && attempt.recordingUrl ? (
            <button type="button" className={styles.secondaryButton} onClick={() => setConfirm(true)}>
              <Download aria-hidden />
              {t('alk.li.download')}
            </button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
