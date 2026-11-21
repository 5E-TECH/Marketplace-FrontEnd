import { Check, ChevronLeft, ImageIcon, Monitor, Phone, Play, Smartphone } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Dialog } from '../../../shared/ui/Dialog/Dialog';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { SafeImage } from '../../../shared/ui/SafeImage/SafeImage';
import type { AdminProduct, Creative, OfferContent, ProductPricing } from '../model/adminProductTypes';
import styles from './LandingPreviewDialog.module.css';

export type LandingVariant = 's1' | 's3';
type Device = 'phone' | 'desktop';

interface LandingPreviewDialogProps {
  product: AdminProduct;
  creatives: readonly Creative[];
  content: OfferContent | undefined;
  pricing: ProductPricing | undefined;
  initialVariant?: LandingVariant;
  onClose: () => void;
}

/**
 * Sotuvchi sahifasini oldindan ko'rish (FE-12 TC4; dizayn.md 3.5 [taklif]): S1 — forma mahsulot sahifasida,
 * S3 — «Buyurtma berish» alohida qadamga olib o'tadi. Ariza yuborilmaydi, piksel ishlamaydi. Ko'rinish narx,
 * offer matnlari va kreativlardan yig'iladi (storefront SF-01/SF-02 tuzilmasi bilan).
 */
export function LandingPreviewDialog({ product, creatives, content, pricing, initialVariant = 's1', onClose }: LandingPreviewDialogProps) {
  const { t } = useTranslation();
  const [variant, setVariant] = useState<LandingVariant>(initialVariant);
  const [device, setDevice] = useState<Device>('phone');
  const [step, setStep] = useState<1 | 2>(1);
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const price = pricing ? pricing.approvedPrice ?? pricing.calculation.recommended : product.approvedPrice ?? 0;
  const delivery = pricing?.calculation.delivery;
  const free = pricing?.params.deliveryMode === 'FREE';
  const center = delivery?.visibleCenter ?? 0;
  const door = delivery?.visibleAddress ?? 0;
  const images = creatives.filter((item) => item.type === 'IMAGE');
  const video = creatives.find((item) => item.type === 'VIDEO');
  const cover = images[0]?.url ?? product.images[0] ?? null;
  const total = price + center;
  const highlights = content?.highlights ?? [];
  const box = content?.boxContents ?? [];
  const chooseVariant = (next: LandingVariant) => { setVariant(next); setStep(1); };

  const segment = <T extends string>(label: string, value: T, options: readonly [T, string, ReactNode][], onChange: (value: T) => void) => (
    <div className={styles.segment} role="radiogroup" aria-label={label}>
      {options.map(([key, text, icon]) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} onClick={() => onChange(key)}>{icon}{text}</button>
      ))}
    </div>
  );

  const priceBlock = (
    <>
      <p className={styles.price}><strong>{sum(price)}</strong> <span>{t('lp.priceLabel')}</span></p>
      <div className={styles.options} role="radiogroup" aria-label={t('lp.deliveryTitle')}>
        <label><input type="radio" name="lp-delivery" defaultChecked disabled /><span>{t('lp.toCenter')}<strong>{free ? t('lp.free') : sum(center)}</strong></span></label>
        {door && !free ? <label><input type="radio" name="lp-delivery" disabled /><span>{t('lp.toDoor')}<strong>{sum(door)}</strong></span></label> : null}
      </div>
      <p className={styles.total}>{t('lp.total', { amount: formatMoney(total) })}</p>
      <p className={styles.check}><Check aria-hidden />{t('lp.payOnDelivery')}</p>
    </>
  );

  const form = (
    <div className={styles.form} aria-label={t('lp.order')}>
      <label>{t('lp.name')}<input disabled /></label>
      <label>{t('lp.phoneLabel')}<span className={styles.phoneField}><span>+998</span><input disabled placeholder="90 123 45 67" /></span></label>
      <label>{t('lp.region')}<select disabled><option>—</option></select></label>
      <label>{t('lp.district')}<select disabled><option>—</option></select></label>
      <label>{t('lp.street')}<input disabled /></label>
      <label className={styles.consent}><input type="checkbox" disabled />{t('lp.consent')}</label>
      <p className={styles.total}>{t('lp.total', { amount: formatMoney(total) })}</p>
      <button type="button" className={styles.cta} disabled>{t('lp.submit')}</button>
    </div>
  );

  const sections = variant === 's1' ? (
    <>
      <section><h3>{t('lp.about', { name: product.name })}</h3>{highlights.length ? <ul className={styles.ticks}>{highlights.map((line) => <li key={line}><Check aria-hidden />{line}</li>)}</ul> : <p className={styles.muted}>{t('lp.noHighlights')}</p>}</section>
      {box.length ? <section><h3>{t('lp.box')}</h3><p>{box.join(', ')}</p></section> : null}
      {product.description ? <section><h3>{t('lp.description')}</h3><p>{product.description}</p>{product.isBad ? <p><strong>{t('lp.notMedicine')}</strong></p> : null}</section> : null}
    </>
  ) : (
    <>
      {box.length ? <section><h3>{t('lp.whatsInBox')}</h3><ul className={styles.ticks}>{box.map((line) => <li key={line}><Check aria-hidden />{line}</li>)}</ul></section> : null}
      <section><h3>{t('lp.aboutProduct')}</h3>{highlights.length ? <ul className={styles.ticks}>{highlights.map((line) => <li key={line}><Check aria-hidden />{line}</li>)}</ul> : <p className={styles.muted}>{t('lp.noHighlights')}</p>}{product.isBad ? <p><strong>{t('lp.notMedicine')}</strong></p> : null}</section>
      <section>
        <h3>{t('lp.deliveryTitle')}</h3>
        <table className={styles.table}>
          <thead><tr><th>{t('lp.where')}</th><th>{t('lp.deliveryCol')}</th><th>{t('lp.totalCol')}</th></tr></thead>
          <tbody>
            <tr><td>{t('lp.toCenter')}</td><td>{free ? t('lp.free') : sum(center)}</td><td>{sum(total)}</td></tr>
            {door && !free ? <tr><td>{t('lp.toDoor')}</td><td>{sum(door)}</td><td>{sum(price + door)}</td></tr> : null}
          </tbody>
        </table>
      </section>
    </>
  );

  const page = step === 2 ? (
    <div className={styles.pageBody}>
      <button type="button" className={styles.back} onClick={() => setStep(1)}><ChevronLeft aria-hidden />{t('lp.back')}</button>
      <p className={styles.stepLabel}>{t('lp.step')}</p>
      <h2 className={styles.name}>{product.name}</h2>
      {form}
    </div>
  ) : (
    <div className={styles.pageBody} data-device={device}>
      <div className={styles.media}>
        {cover ? <SafeImage src={cover} alt={product.name} /> : null}
        <ImageIcon aria-hidden className={styles.mediaIcon} />
        {video ? <span className={styles.videoChip}><Play aria-hidden />{t('aoffer.creativeVideo')}</span> : null}
        {images.length ? <span className={styles.counter}>1 / {images.length}</span> : null}
      </div>
      <div className={styles.info}>
        <h2 className={styles.name}>{product.name}</h2>
        {product.subtitle ? <p className={styles.subtitle}>{product.subtitle}</p> : null}
        {priceBlock}
        <button type="button" className={styles.cta} onClick={variant === 's3' ? () => setStep(2) : undefined} aria-disabled={variant === 's1' || undefined}>{t('lp.order')}</button>
        {variant === 's3' ? (
          <>
            <p className={styles.check}><Check aria-hidden />{t('lp.noPayNow')}</p>
            <p className={styles.note}><Phone aria-hidden />{t('lp.operatorCalls')}</p>
          </>
        ) : form}
      </div>
      <div className={styles.sections}>{sections}</div>
    </div>
  );

  return (
    <Dialog
      open
      title={t('lp.title')}
      description={t('lp.subtitle', { name: product.name })}
      icon={<Smartphone />}
      width={device === 'phone' ? 520 : 1040}
      onClose={onClose}
      testId="landing-preview"
    >
      <div className={styles.controls}>
        {segment(t('lp.variant'), variant, [['s1', t('lp.s1'), null], ['s3', t('lp.s3'), null]], chooseVariant)}
        {segment(t('lp.device'), device, [['phone', t('lp.phone'), <Smartphone key="p" aria-hidden />], ['desktop', t('lp.desktop'), <Monitor key="d" aria-hidden />]], setDevice)}
      </div>
      <div className={styles.frame} data-device={device} data-variant={variant} data-testid={`landing-preview-${variant}`}>
        <div className={styles.siteHeader}>Elchi Market</div>
        {page}
      </div>
      <p className={styles.footnote}>{t('lp.note')}</p>
    </Dialog>
  );
}
