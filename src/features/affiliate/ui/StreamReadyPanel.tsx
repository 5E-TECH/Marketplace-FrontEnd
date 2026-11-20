import { CircleCheck, Link2, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import type { AffiliateStream } from '../model/offerTypes';
import { CopyLinkButton, OpenLinkButton, StreamLinkBox } from './StreamLink';
import styles from './StreamReadyPanel.module.css';

interface StreamReadyPanelProps {
  stream: AffiliateStream;
  /** Har sotuvdan haq (shu narxda). */
  fee: number;
  /** Markazgacha yetkazish; noma'lum bo'lsa qator «+ yetkazish»siz. */
  deliveryFee?: number | null;
  /**
   * `created` — offerlar sahifasida karta ostida, uchburchak shu kartaga (sotuvchi-offerlar);
   * `settings` — «Sahifani sozlash» boshida (sotuvchi-sahifa-sozlash).
   */
  variant: 'created' | 'settings';
  subtitle?: ReactNode;
  /** `created`: bosilgan karta ustuni — uchburchak shu ustun o'rtasida. */
  pointer?: { column: number; columns: number };
}

/** «Sahifa tayyor» (SOT-3): havola, «Nusxa olish», «Ochib ko‘rish» va hozirgi sozlamalar. QR — karta bo'yicha yo'q. */
export function StreamReadyPanel({ stream, fee, deliveryFee, variant, subtitle, pointer }: StreamReadyPanelProps) {
  const { t } = useTranslation();
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const price = deliveryFee ? t('streams.priceWithDelivery', { price: sum(stream.salePrice), delivery: sum(deliveryFee) }) : sum(stream.salePrice);
  const template = t(`streams.template.${stream.template}` as TranslationKey);
  const gap = 20;
  const pointerLeft = pointer
    ? `calc((100% - ${(pointer.columns - 1) * gap}px) / ${pointer.columns} * ${pointer.column + 0.5} + ${pointer.column * gap}px - 12px)`
    : undefined;

  return (
    <section className={styles.panel} data-variant={variant} role="status" aria-labelledby={`ready-${stream.id}`} data-testid="stream-ready">
      {pointerLeft ? (
        <svg className={styles.pointer} style={{ left: pointerLeft }} width="24" height="12" viewBox="0 0 24 12" aria-hidden>
          <path d="M0 12 L12 0 L24 12 Z" />
        </svg>
      ) : null}
      <div className={styles.head}>
        <span className={styles.title}>
          <CircleCheck aria-hidden />
          <h2 id={`ready-${stream.id}`}>{t('streams.ready')}</h2>
        </span>
        {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
      </div>
      <div className={styles.linkRow}>
        <StreamLinkBox link={stream.link} size={variant === 'settings' ? 'md' : 'lg'} />
        <div className={styles.actions}>
          <CopyLinkButton link={stream.link} />
          <OpenLinkButton link={stream.link} />
        </div>
      </div>
      {variant === 'created' ? (
        <div className={styles.foot}>
          <p className={styles.summary}>
            {t('streams.summaryTemplate')} <b>{template}</b>
            <span className={styles.dot}>·</span>
            {t('streams.summaryPrice')} <b>{price}</b>
            <span className={styles.dot}>·</span>
            {t('streams.summaryFee')} <b>{sum(fee)}</b>
          </p>
          <div className={styles.later}>
            <p>{t('streams.configureLater')}</p>
            <Link to={`/affiliate/pages/${stream.id}`} className={styles.settingsLink}>
              <SlidersHorizontal aria-hidden />
              {t('streams.configure')}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className={styles.current}>
            {t('streams.currentTemplate')} <strong>{template}</strong> · {t('streams.currentPrice')} <strong>{price}</strong> · {t('streams.currentFee')} <strong>{sum(fee)}</strong>
          </p>
          <p className={styles.note}>
            <Link2 aria-hidden />
            <span>{t('streams.attribution')}</span>
          </p>
        </>
      )}
    </section>
  );
}
