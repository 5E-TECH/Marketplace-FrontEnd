import { Camera, Download, Eye, FileText, Play, Tag, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import { formatCm, formatKg, formatStamp } from '../lib/productFormat';
import type { AdminProduct, Creative, ProductPricing } from '../model/adminProductTypes';
import styles from './ProductSubmission.module.css';

interface ProductSubmissionProps {
  product: AdminProduct;
  categoryName: string | null;
  creatives: readonly Creative[];
  pricing: ProductPricing | undefined;
  phone: boolean;
}

const duration = (seconds: number | null | undefined) =>
  seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : null;

/**
 * «Mahsulot — optovik yuborgan ma'lumot» (admin-moderatsiya): rasm va video, tavsif, ma'lumotlar, sertifikat.
 * Video — admin kutubxonasidagi kreativ (BE-08); yo'q bo'lsa ogohlantirish (SOT-9).
 */
export function ProductSubmission({ product, categoryName, creatives, pricing, phone }: ProductSubmissionProps) {
  const { t } = useTranslation();
  const videos = creatives.filter((creative) => creative.type === 'VIDEO');
  const images = product.images;
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const tariff = pricing?.tariff;
  const weight = product.weightGrams;
  const weightHint = tariff && weight
    ? weight <= tariff.baseWeightGrams
      ? t('moderation.weightBase', { kg: formatKg(tariff.baseWeightGrams), fee: formatMoney(pricing.calculation.delivery.tariffCenter) })
      : t('moderation.weightOver', { kg: formatKg(weight), fee: formatMoney(pricing.calculation.delivery.tariffCenter) })
    : null;
  const priceHint = pricing
    ? t('moderation.basePriceHint', {
      recommended: formatMoney(pricing.calculation.recommendedBase),
      customer: formatMoney(pricing.calculation.recommended),
      mode: t(`moderation.mode.${pricing.params.deliveryMode}` as TranslationKey),
    })
    : null;
  const tiles = videos.length + images.length;

  return (
    <div className={styles.sections}>
      <section aria-labelledby={`media-${product.id}`}>
        <h3 id={`media-${product.id}`} className={styles.title}>
          {t('moderation.media')} <span>{t('moderation.mediaHint')}</span>
        </h3>
        {tiles ? (
          <ul className={styles.media} data-phone={phone || undefined} aria-label={t(phone ? 'moderation.mediaListPhone' : 'moderation.mediaList')}>
            {videos.map((video) => (
              <li key={video.id}>
                <span className={styles.tile}>
                  <span className={styles.placeholder}>
                    <span><Play aria-hidden />{t('moderation.video')}</span>
                    {duration(video.durationSec) ? <span>{duration(video.durationSec)}</span> : null}
                  </span>
                  {video.caption ? <span className={styles.chip}>{video.caption}</span> : null}
                </span>
                <span className={styles.tileLabel}>{t('moderation.video')}</span>
              </li>
            ))}
            {images.map((url, index) => (
              <li key={url}>
                <span className={styles.tile}>
                  <span className={styles.placeholder}>
                    <span><Camera aria-hidden />{t('moderation.photo')}</span>
                  </span>
                  <SafeImage src={url} alt={t('moderation.imageN', { index: index + 1, total: images.length })} />
                  {index === 0 ? <span className={styles.chip}>{t('moderation.main')}</span> : null}
                </span>
                <span className={styles.tileLabel}>{t('moderation.imageN', { index: index + 1, total: images.length })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>{t('moderation.noImages')}</p>
        )}
        {videos.length === 0 ? (
          <div className={styles.warning} role="note">
            <Video aria-hidden />
            <div>
              <p className={styles.warningTitle}>{t('moderation.noVideo')}</p>
              <p>{t('moderation.noVideoText')}</p>
              <Link className={styles.inlineLink} to={`/admin/products/${encodeURIComponent(product.id)}?tab=creatives`}>{t('moderation.toCreatives')}</Link>
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby={`description-${product.id}`}>
        <h3 id={`description-${product.id}`} className={styles.title} data-gap>
          {t('moderation.description')} <span>{t('moderation.descriptionHint')}</span>
        </h3>
        <p className={styles.description}>{product.description ?? t('moderation.noDescription')}</p>
      </section>

      <section aria-labelledby={`details-${product.id}`}>
        <h3 id={`details-${product.id}`} className={styles.title} data-gap>{t('moderation.details')}</h3>
        <dl className={styles.details}>
          <div>
            <dt>{t('moderation.field.category')}</dt>
            <dd>{categoryName ?? t('moderation.noValue')}</dd>
          </div>
          <div>
            <dt>{t('moderation.weight')}</dt>
            <dd>{weight ? t('moderation.kg', { value: formatKg(weight) }) : t('moderation.noValue')}</dd>
            {weightHint ? <dd className={styles.hint}>{weightHint}</dd> : null}
          </div>
          <div>
            <dt>{t('moderation.size')}</dt>
            <dd>
              {product.lengthMm && product.widthMm && product.heightMm
                ? t('moderation.sizeValue', { length: formatCm(product.lengthMm), width: formatCm(product.widthMm), height: formatCm(product.heightMm) })
                : t('moderation.noValue')}
            </dd>
          </div>
          <div>
            <dt>{t('moderation.expiry')}</dt>
            <dd>{t(product.expiryTracked ? 'moderation.expiryYes' : 'moderation.expiryNo')}</dd>
            <dd className={styles.hint}>{t(product.expiryTracked ? 'moderation.expiryYesHint' : 'moderation.expiryNoHint')}</dd>
          </div>
          <div>
            <dt>{t('moderation.basePrice')}</dt>
            <dd>{product.basePrice === null ? t('moderation.noValue') : sum(product.basePrice)}</dd>
            {priceHint ? <dd className={styles.hint}>{priceHint}</dd> : null}
          </div>
        </dl>
        <Link className={styles.priceLink} to={`/admin/moderation?tab=prices&product=${encodeURIComponent(product.id)}`}>
          <Tag aria-hidden />
          {t('moderation.openPrice')}
        </Link>
      </section>

      <section aria-labelledby={`certificate-${product.id}`}>
        <h3 id={`certificate-${product.id}`} className={styles.title} data-gap="12">
          {t('moderation.certificate')} <span>{t('moderation.certificateHint')}</span>
        </h3>
        {product.certificate ? (
          <>
            <div className={styles.file} data-phone={phone || undefined}>
              <span className={styles.fileIcon} aria-hidden><FileText /></span>
              <span className={styles.fileName}>
                <span>{product.certificate.name}</span>
                <span>{t('moderation.certificateMeta', { date: formatStamp(product.certificate.uploadedAt) })}</span>
              </span>
              <span className={styles.fileActions}>
                <a className={styles.openButton} href={product.certificate.url} target="_blank" rel="noopener noreferrer">
                  <Eye aria-hidden />
                  {t('moderation.open')}
                </a>
                <a className={styles.iconButton} href={product.certificate.url} download aria-label={t('moderation.download')} title={t('moderation.download')}>
                  <Download aria-hidden />
                </a>
              </span>
            </div>
            <div className={styles.certificateBody}>
              <div className={styles.sheet} role="img" aria-label={t('moderation.certificatePreview')}>
                <span><FileText aria-hidden />{product.certificate.name}</span>
                <span>{t('moderation.certificatePage')}</span>
                {[62, 88, 74, 91, 55].map((width) => <span key={width} className={styles.line} style={{ width: `${width}%` }} />)}
              </div>
              <div className={styles.checkText}>
                <p>{t('moderation.certificateWhat')}</p>
                <ul>
                  <li>{t('moderation.certificateCheck1')}</li>
                  <li>{t('moderation.certificateCheck2')}</li>
                </ul>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.warning} role="note">
            <FileText aria-hidden />
            <div>
              <p className={styles.warningTitle}>{t('moderation.noCertificate')}</p>
              <p>{t('moderation.noCertificateText')}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
