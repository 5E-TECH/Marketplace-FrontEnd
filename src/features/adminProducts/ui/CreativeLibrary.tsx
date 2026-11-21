import { Dropdown } from 'antd';
import { ImageIcon, MoreHorizontal, Play, Trash2, Upload } from 'lucide-react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { usePhoneActionBar } from '../../../shared/ui/PageActionBar/usePhoneActionBar';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import { creativeLabel, formatStamp } from '../lib/productFormat';
import type { Creative } from '../model/adminProductTypes';
import styles from './CreativeLibrary.module.css';

const duration = (seconds: number | null | undefined) =>
  seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : null;

interface CreativeLibraryProps {
  creatives: readonly Creative[];
  view: 'grid' | 'list';
  onOpen: (creative: Creative) => void;
  onDelete: (creative: Creative) => void;
}

/**
 * Kreativlar kutubxonasi (admin-offer «Kreativlar kutubxonasi», «Kreativlar» yorlig'i): admin yuklaydi,
 * moderatsiya yo'q (karta: sotuvchi kreativ yuklamaydi). Har kreativda — ochish va o'chirish.
 */
export function CreativeLibrary({ creatives, view, onOpen, onDelete }: CreativeLibraryProps) {
  const { t } = useTranslation();
  const phone = usePhoneActionBar();
  const size = (creative: Creative) => (creative.size >= 1024 * 1024
    ? t('creatives.mb', { value: (creative.size / 1024 / 1024).toFixed(1) })
    : t('creatives.kb', { value: formatMoney(Math.round(creative.size / 1024)) }));
  const kind = (creative: Creative) => `${creative.mimeType}${duration(creative.durationSec) ? ` · ${duration(creative.durationSec)}` : ''}`;
  const menu = (creative: Creative) => {
    const label = t('aoffer.creativeMenu', { name: creativeLabel(creative, creatives, t) });
    return (
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: [
            { key: 'open', icon: creative.type === 'VIDEO' ? <Play aria-hidden /> : <ImageIcon aria-hidden />, label: t('aoffer.creativeOpen') },
            { key: 'delete', icon: <Trash2 aria-hidden />, label: t('aoffer.creativeDelete'), danger: true },
          ],
          onClick: ({ key }) => (key === 'open' ? onOpen(creative) : onDelete(creative)),
        }}
      >
        <button type="button" className={styles.menuButton} aria-label={label} title={label}><MoreHorizontal aria-hidden /></button>
      </Dropdown>
    );
  };

  // Telefon (admin-offer holatlar Ph6): jadval o'rnida kartalar.
  if (view === 'list' && phone) {
    return (
      <ul className={styles.cards} data-testid="creatives-cards">
        {creatives.map((creative) => (
          <li key={creative.id}>
            <Thumb creative={creative} small />
            <span className={styles.cardText}>
              <strong>{creativeLabel(creative, creatives, t)}</strong>
              <span>{[creative.caption, kind(creative), size(creative)].filter(Boolean).join(' · ')}</span>
              <span>{formatStamp(creative.createdAt)}</span>
            </span>
            {menu(creative)}
          </li>
        ))}
      </ul>
    );
  }

  if (view === 'list') {
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table} data-testid="creatives-table">
          <thead>
            <tr>
              <th>{t('creatives.col.preview')}</th>
              <th>{t('creatives.col.type')}</th>
              <th>{t('creatives.col.size')}</th>
              <th>{t('creatives.col.added')}</th>
              <th><span className={styles.visuallyHidden}>{t('creatives.col.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {creatives.map((creative) => (
              <tr key={creative.id}>
                <td>
                  <span className={styles.rowPreview}>
                    <Thumb creative={creative} small />
                    <span>
                      <strong>{creativeLabel(creative, creatives, t)}</strong>
                      {creative.caption ? <span>{creative.caption}</span> : null}
                    </span>
                  </span>
                </td>
                <td>{kind(creative)}</td>
                <td>{size(creative)}</td>
                <td>{formatStamp(creative.createdAt)}</td>
                <td className={styles.actions}>{menu(creative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <ul className={styles.grid} data-testid="creatives-grid">
      {creatives.map((creative) => (
        <li key={creative.id}>
          <span className={styles.tile}>
            <button type="button" className={styles.tileOpen} onClick={() => onOpen(creative)} aria-label={`${creativeLabel(creative, creatives, t)}: ${t('aoffer.creativeOpen')}`}>
              <Thumb creative={creative} />
            </button>
            <span className={styles.tileMenu}>{menu(creative)}</span>
          </span>
          <span className={styles.tileLabel}>
            <strong>{creativeLabel(creative, creatives, t)}</strong>
            <span>{[creative.caption, creative.type === 'VIDEO' ? duration(creative.durationSec) : null].filter(Boolean).join(' · ')}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Thumb({ creative, small = false }: { creative: Creative; small?: boolean }) {
  return (
    <span className={styles.thumb} data-small={small || undefined}>
      {creative.type === 'VIDEO' ? <Play aria-hidden /> : <ImageIcon aria-hidden />}
      {creative.type === 'IMAGE' ? <SafeImage src={creative.url} alt="" loading="lazy" /> : null}
    </span>
  );
}

export function UploadButton({ onClick, primary = true }: { onClick: () => void; primary?: boolean }) {
  const { t } = useTranslation();
  return (
    <button type="button" className={primary ? styles.uploadPrimary : styles.uploadSecondary} onClick={onClick}>
      <Upload aria-hidden />
      {t('aoffer.upload')}
    </button>
  );
}
