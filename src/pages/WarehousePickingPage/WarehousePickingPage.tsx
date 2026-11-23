import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePickListQuery } from '../../features/fulfillment/api/fulfillmentQueries';
import { pickSheetPath } from '../../features/fulfillment/lib/pickRules';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { addDays, tashkentClock, tashkentDate } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import { PackTab } from './components/PackTab';
import { ParcelList, PickTab } from './components/PickTab';
import { WaveCard, type WaveDay } from './components/WaveCard';
import styles from './WarehousePickingPage.module.css';

/**
 * «Yig'ish va qadoq» (FE-17; ombor-yigish, ombor-qadoq): kunlik yig'ish ro'yxati (OMB-4: 14:00 gacha tasdiqlangan —
 * bugun, keyin — ertaga), skaner bilan yig'ish (noto'g'ri tovar bloklanadi — OMB-2, TC1), tortish va yorliq (TC2),
 * «Qadoqlandi». Ertangi to'lqin faqat ko'rinadi: ertangi posilkani bugun yig'ish — TZ'da yo'q.
 */
export default function WarehousePickingPage() {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'pack' ? 'pack' : 'pick';
  const day: WaveDay = params.get('day') === 'tomorrow' ? 'tomorrow' : 'today';
  const today = tashkentDate();
  const tomorrow = addDays(today, 1);
  const todayQuery = usePickListQuery(today);
  const tomorrowQuery = usePickListQuery(tomorrow);
  const todayItems = useMemo(() => todayQuery.data?.items ?? [], [todayQuery.data]);
  // Ertangi so'rovda bugungilar ham keladi (`pick_date <= ertaga`) — faqat ertangisi.
  const tomorrowItems = useMemo(() => (tomorrowQuery.data?.items ?? []).filter((task) => task.pickDate === tomorrow), [tomorrow, tomorrowQuery.data]);
  const items = day === 'today' ? todayItems : tomorrowItems;
  const catalog = useMemo(() => [...todayItems, ...tomorrowItems], [todayItems, tomorrowItems]);
  // Telefon (ombor-yigish.mobil): skan bloki — sahifaning birinchi bloki, to'lqin kartasi — joriy posilkadan keyin.
  const [scanSlot, setScanSlot] = useState<HTMLDivElement | null>(null);
  const phonePick = phone && tab === 'pick' && day === 'today';

  const go = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => (value === null ? merged.delete(key) : merged.set(key, value)));
    setParams(merged, { replace: true });
  };

  if (todayQuery.isError && !todayQuery.data) return <LoadError error={todayQuery.error} onRetry={() => void todayQuery.refetch()} />;
  if (todayQuery.isPending) return <PageLoader compact />;

  const counts = { pick: todayItems.filter((task) => task.status === 'TO_PICK').length, pack: todayItems.filter((task) => task.status === 'PICKED').length };
  const updatedAt = todayQuery.dataUpdatedAt ? tashkentClock(todayQuery.dataUpdatedAt) : '—';
  const waveCard = (
    <WaveCard
      day={day}
      date={day === 'today' ? today : tomorrow}
      items={items}
      counts={{ today: todayItems.length, tomorrow: tomorrowItems.length }}
      onDay={(value) => go({ day: value === 'tomorrow' ? 'tomorrow' : null })}
      sheetHref={pickSheetPath(day === 'today' ? today : tomorrow)}
    />
  );

  return (
    <div className={styles.page} data-testid="picking-page" data-tab={tab} data-day={day}>
      {phonePick ? <div ref={setScanSlot} className={styles.scanSlot} /> : null}
      <div className={styles.topRow}>
        <nav className={styles.pills} aria-label={t('ful.page.tabsAria')}>
          {(['pick', 'pack'] as const).map((value) => (
            <button key={value} type="button" className={styles.pill} aria-current={tab === value ? 'page' : undefined} onClick={() => go({ tab: value === 'pack' ? 'pack' : null, task: null, day: null })}>
              {t(value === 'pick' ? 'ful.page.pick' : 'ful.page.pack')}
              <span className={styles.pillCount}>{counts[value]}</span>
            </button>
          ))}
        </nav>
        <div className={styles.updated}>
          <span>{t('ful.page.updated')} <strong>{updatedAt}</strong></span>
          <button type="button" className={styles.refresh} onClick={() => void Promise.all([todayQuery.refetch(), tomorrowQuery.refetch()])}>
            <RefreshCw aria-hidden />{t('ful.page.refresh')}
          </button>
        </div>
      </div>

      {tab === 'pick' && !phonePick ? waveCard : null}

      {tab === 'pack'
        ? <PackTab items={todayItems} selectedId={params.get('task')} phone={phone} onToPick={() => go({ tab: null, task: null })} />
        : day === 'tomorrow'
          ? <ParcelList items={tomorrowItems} current={null} />
          : <PickTab items={todayItems} catalog={catalog} phone={phone} scanSlot={scanSlot} afterParcel={phonePick ? waveCard : null} onPack={(task) => go({ tab: 'pack', task: task.taskId, day: null })} />}
    </div>
  );
}
