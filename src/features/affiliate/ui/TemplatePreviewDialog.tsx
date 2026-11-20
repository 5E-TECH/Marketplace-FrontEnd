import { ImageIcon, LayoutTemplate, Play, Video } from 'lucide-react';
import { useState } from 'react';
import { BRAND } from '../../../shared/config/brand';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { ChartSegment } from '../../../shared/ui/Chart/ChartSegment';
import { DialogCancel, DialogPrimary, Dialog } from '../../../shared/ui/Dialog/Dialog';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import type { StreamTemplate } from '../model/offerTypes';
import styles from './TemplatePreviewDialog.module.css';

const BRAND_ICON = '/brand/elchi-app-icon.png';

interface TemplatePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  initial: StreamTemplate;
  product: { name: string; subtitle?: string | null; imageUrl?: string | null };
  /** Mijoz ko'radigan narx (sozlamada — kiritilgan, hali saqlanmagan bo'lishi mumkin). */
  price: number;
  centerFee: number | null | undefined;
  doorFee: number | null | undefined;
  /** «Sahifani sozlash»: tanlangan shablonni formaga qo'yadi. Berilmasa faqat «Yopish». */
  onChoose?: (template: StreamTemplate) => void;
}

/**
 * «Shablonni oldindan ko‘rish» (sotuvchi-offer, sotuvchi-sahifa-sozlash oynalari): chapda shablon va
 * nima ko'rinishi, o'ngda telefon sxemasi (390 px). Sxema — haqiqiy sahifa «Ochib ko‘rish» da.
 */
export function TemplatePreviewDialog({ open, onClose, initial, product, price, centerFee, doorFee, onChoose }: TemplatePreviewDialogProps) {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<StreamTemplate>(initial);
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const total = price + (centerFee ?? 0);
  const rows = [
    ['first', template === 'VIDEO' ? 'preview.firstVideo' : 'preview.firstImage'],
    ['text', 'preview.textValue'],
    ['price', null],
    ['form', 'preview.formValue'],
    ['hidden', 'preview.hiddenValue'],
  ] as const;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={720}
      title={t('preview.title')}
      description={t('preview.subtitle', { product: product.name })}
      icon={<LayoutTemplate />}
      testId="template-preview"
      footer={
        <>
          <DialogCancel onClick={onClose}>{t('dialog.close')}</DialogCancel>
          {onChoose ? (
            <DialogPrimary shortcut={false} onClick={() => onChoose(template)}>
              {t('preview.choose')}
            </DialogPrimary>
          ) : null}
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.info}>
          <span className={styles.label} id="preview-template">{t('preview.template')}</span>
          <ChartSegment
            label={t('preview.template')}
            value={template}
            onChange={setTemplate}
            showLabels
            options={[
              { value: 'STANDART', label: t('streams.template.STANDART'), icon: <ImageIcon aria-hidden /> },
              { value: 'VIDEO', label: t('streams.template.VIDEO'), icon: <Video aria-hidden /> },
            ]}
          />
          <dl className={styles.rows}>
            {rows.map(([key, value]) => (
              <div key={key}>
                <dt>{t(`preview.${key}` as TranslationKey)}</dt>
                <dd>
                  {value
                    ? t(value)
                    : t('preview.priceValue', { price: formatMoney(price), delivery: formatMoney(centerFee ?? 0), total: sum(total) })}
                </dd>
              </div>
            ))}
          </dl>
          <p className={styles.note}>{t('preview.note')}</p>
        </div>
        <div className={styles.stage}>
          <div className={styles.phone} role="img" aria-label={t('preview.schema', { template: t(`streams.template.${template}` as TranslationKey) })}>
            <div className={styles.hero}>
              <div className={styles.bar}>
                <span className={styles.brand}>
                  <img src={BRAND_ICON} alt="" width={24} height={24} />
                  {BRAND.name}
                </span>
                <span className={styles.courier}>{t('preview.courier')}</span>
              </div>
              <div className={styles.media} data-video={template === 'VIDEO' || undefined}>
                {template === 'VIDEO' ? (
                  <span className={styles.play}><Play aria-hidden /></span>
                ) : (
                  <>
                    <ImageIcon aria-hidden />
                    {product.imageUrl ? <SafeImage src={product.imageUrl} alt="" /> : null}
                  </>
                )}
                {template === 'STANDART' ? <span className={styles.counter}>1/4</span> : null}
              </div>
            </div>
            <div className={styles.title}>
              <span>{product.name}</span>
              {product.subtitle ? <span>{product.subtitle}</span> : null}
            </div>
            <div className={styles.priceBox}>
              <span className={styles.bigPrice}>{formatMoney(price)} <small>{t('preview.som')}</small></span>
              {centerFee ? <span className={styles.line}><span>{t('preview.deliveryCenter')}</span><strong>{sum(centerFee)}</strong></span> : null}
              {doorFee ? <span className={styles.line}><span>{t('preview.deliveryDoor')}</span><strong>{sum(doorFee)}</strong></span> : null}
              <span className={styles.total}><span>{t('preview.totalCenter')}</span><span>{sum(total)}</span></span>
            </div>
            <span className={styles.order}>{t('preview.order')}</span>
            <span className={styles.hint}>{t('preview.orderHint')}</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
