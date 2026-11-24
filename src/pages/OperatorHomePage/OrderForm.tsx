import { CircleX, Lock, MapPin, Minus, Package, Plus, Scale, ShieldAlert, TriangleAlert, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRegionTree } from '../../features/address/api/regionsQueries';
import type { AddressField, AddressValue } from '../../features/address/lib/addressValue';
import { AddressFields } from '../../features/address/ui/AddressFields';
import { dayLabel, sum } from '../../features/operator/lib/leadFormat';
import { kgLabel, shipDay } from '../../features/operator/lib/orderRules';
import type { LeadCard, LeadPrice, LeadProductInfo, WhereDeliver } from '../../features/operator/model/operatorTypes';
import { rich } from '../../shared/i18n/richText';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import styles from './OrderForm.module.css';

export interface OrderDraft {
  address: AddressValue;
  whereDeliver: WhereDeliver;
  quantity: number;
  comment: string;
}

/** Ogohlantirish (band qilinmadi, manzil tasdiqlanmadi) — forma boshida (19-kadr). */
export interface OrderAlert {
  title: string;
  text: string;
}

export type OrderFieldErrors = Partial<Record<AddressField | 'whereDeliver', string>>;

interface OrderFormProps {
  card: LeadCard;
  draft: OrderDraft;
  /** Mijoz yozgan manzil va tanlagan yetkazish (lid formasidan); API lidida — yo'q. */
  original: AddressValue | null;
  originalWhere: WhereDeliver | null;
  /** Joriy server summasi (lid kartasidagi yoki `quote`). */
  price: LeadPrice | null;
  /** Lid kelgandagi narx obyekti — og'irlik oshganda «52 000 → 76 000». */
  initial: LeadPrice | null;
  product: LeadProductInfo | undefined;
  errors: OrderFieldErrors;
  alert: OrderAlert | null;
  showRequired: boolean;
  now: number;
  busy: boolean;
  onChange: (patch: Partial<OrderDraft>) => void;
}

const OTHER: Record<WhereDeliver, WhereDeliver> = { CENTER: 'ADDRESS', ADDRESS: 'CENTER' };
const MAX_QUANTITY = 1000;

/**
 * «Buyurtma formasi» (operator-buyurtma-formasi, DZ-12): mijoz yozgan manzil — operator o'qib tasdiqlatadi yoki
 * tuzatadi; yetkazish turi, miqdor va og'irlik bo'yicha summa serverdan (BE-09). Upsell — keyin (FE-29).
 */
export function OrderForm({ card, draft, original, originalWhere, price, initial, product, errors, alert, showRequired, now, busy, onChange }: OrderFormProps) {
  const { t } = useTranslation();
  const tree = useRegionTree();
  const district = tree.data?.find((item) => item.satoCode === draft.address.regionSoato)?.districts.find((item) => item.satoCode === draft.address.districtSoato);
  const noDoor = district?.doorDelivery === false;
  const available = product?.available ?? null;
  const fee = (value: number | null | undefined) => (value == null ? '—' : value === 0 ? t('opo.free') : sum(value));
  const options: Partial<Record<WhereDeliver, number | null>> = price?.deliveryOptions ?? {
    [draft.whereDeliver]: price?.whereDeliver === draft.whereDeliver ? price.deliveryFee : null,
    [OTHER[draft.whereDeliver]]: draft.quantity === 1 ? product?.deliveryFee?.[OTHER[draft.whereDeliver]] ?? null : null,
  };
  const changedWhere = originalWhere !== null && draft.whereDeliver !== originalWhere;
  const weightGrams = price?.weightGrams ?? (product?.weightKg != null ? Math.round(product.weightKg * 1000 * draft.quantity) : null);
  const unitPrice = price?.unitPrice ?? product?.salePrice ?? card.product.salePrice;
  const ship = shipDay(now);
  const stockError = available !== null && available > 0 && draft.quantity > available;
  const limit = available !== null && available > 0 ? Math.min(available, MAX_QUANTITY) : MAX_QUANTITY;
  const setQuantity = (value: number) => onChange({ quantity: Math.min(Math.max(1, value), MAX_QUANTITY) });

  return (
    <div className={styles.form} data-testid="order-form" aria-busy={busy || undefined}>
      <div className={styles.head}>
        <div className={styles.headRow}>
          <h2 className={styles.title}>{t('opw.orderTitle')}</h2>
          {price?.deliveryMode ? <span className={styles.chip} data-testid="order-mode">{t(`opo.mode.${price.deliveryMode}` as TranslationKey)}</span> : null}
        </div>
        <p className={styles.note}>{t('opw.orderOpenHint')}</p>
      </div>

      {card.blacklistRejections ? (
        <div className={styles.callout} data-tone="warning" role="note">
          <ShieldAlert aria-hidden />
          <div>
            <p className={styles.calloutTitle}>{t('opo.blacklistTitle', { count: card.blacklistRejections })}</p>
            <p>{rich(t('opo.blacklistText'), { amount: <strong>{fee(price?.prepayment?.amount ?? price?.deliveryFee)}</strong>, method: price?.prepayment?.method ?? '—' })}</p>
          </div>
        </div>
      ) : null}

      {alert ? (
        <div className={styles.callout} data-tone="danger" role="alert" data-testid="order-alert">
          <Package aria-hidden />
          <div>
            <p className={styles.calloutTitle}>{alert.title}</p>
            <p>{alert.text}</p>
          </div>
        </div>
      ) : null}

      <div className={styles.section}>
        <AddressFields
          dense
          value={draft.address}
          original={original}
          editedBefore={Boolean(card.address?.editedByOperator)}
          showRequired={showRequired}
          errors={errors}
          onChange={(address) => {
            // Eshikkacha bormaydigan tuman tanlansa — markazgacha (4-kadr).
            const next = tree.data?.find((item) => item.satoCode === address.regionSoato)?.districts.find((item) => item.satoCode === address.districtSoato);
            onChange({ address, ...(next?.doorDelivery === false && draft.whereDeliver === 'ADDRESS' ? { whereDeliver: 'CENTER' as const } : {}) });
          }}
        />

        <div className={styles.delivery}>
          <div className={styles.labelRow}>
            <span className={styles.label} id="order-delivery">{t('opw.delivery')}<span className={styles.required} aria-hidden>*</span></span>
            {originalWhere ? (
              <span className={styles.chip} data-tone={changedWhere ? 'warning' : undefined} data-testid="delivery-provenance">
                {changedWhere ? t('opo.changed') : t('opo.chosen')}
              </span>
            ) : null}
          </div>
          <div className={styles.segmented} role="radiogroup" aria-labelledby="order-delivery-type" aria-describedby="order-delivery-note">
            {(['CENTER', 'ADDRESS'] as const).map((value) => {
              const locked = value === 'ADDRESS' && noDoor;
              return (
                <button key={value} type="button" role="radio" aria-checked={draft.whereDeliver === value} className={styles.segment} disabled={locked || busy} title={locked ? t('opo.noDoorShort') : undefined} onClick={() => onChange({ whereDeliver: value })}>
                  {locked ? <Lock aria-hidden /> : null}
                  {t(`opw.deliver.${value}` as TranslationKey)}
                </button>
              );
            })}
          </div>
          <span className={styles.srOnly} id="order-delivery-type">{t('opo.deliveryType')}</span>
          <p className={styles.hint} id="order-delivery-note">
            {/* Narx noma'lum (summa hisoblanmadi) — faqat tushuntirish, chiziqchalarsiz. */}
            {options.CENTER == null && options.ADDRESS == null ? t(`opo.deliveryExplain.${draft.whereDeliver}` as TranslationKey) : rich(t(`opo.deliveryLine.${draft.whereDeliver}` as TranslationKey), {
              center: <span className={styles.num}>{fee(options.CENTER)}</span>,
              address: <span className={styles.num}>{fee(options.ADDRESS)}</span>,
            })}
          </p>
          {changedWhere && originalWhere ? (
            <p className={styles.hint}>{rich(t('opo.deliveryWas'), { where: <strong>{t(`opw.whereDeliver.${originalWhere}` as TranslationKey)}</strong> })}</p>
          ) : null}
          {errors.whereDeliver ? (
            <p className={styles.error} role="alert"><CircleX aria-hidden /><span>{errors.whereDeliver}</span></p>
          ) : null}
        </div>
        {noDoor ? (
          <div className={styles.box} data-tone="info" data-testid="no-door">
            <MapPin aria-hidden />
            <span>{t('opo.noDoor')}</span>
          </div>
        ) : null}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('opo.goods')}</h3>
        <div className={styles.item}>
          <div className={styles.itemHead}>
            <span className={styles.itemName}>{card.product.name}</span>
            <span className={styles.itemPrice}>{draft.quantity > 1 ? t('opo.unitTimes', { price: sum(unitPrice), qty: draft.quantity }) : sum(unitPrice)}</span>
          </div>
          <div className={styles.itemGrid}>
            <div>
              <label className={styles.label} htmlFor="order-qty">{t('opw.quantity')}</label>
              <div className={styles.stepper}>
                <button type="button" aria-label={`${t('opw.decrease')}: ${card.product.name}`} disabled={busy || available === 0 || draft.quantity <= 1} onClick={() => setQuantity(draft.quantity - 1)}><Minus aria-hidden /></button>
                <input
                  id="order-qty"
                  type="text"
                  inputMode="numeric"
                  value={draft.quantity}
                  disabled={busy || available === 0}
                  aria-invalid={stockError || undefined}
                  aria-describedby={stockError ? 'order-qty-error' : undefined}
                  onChange={(event) => {
                    const value = Number(event.target.value.replace(/\D/g, ''));
                    if (value >= 1) setQuantity(value);
                  }}
                />
                <button type="button" aria-label={`${t('opw.increase')}: ${card.product.name}`} disabled={busy || available === 0 || draft.quantity >= limit} onClick={() => setQuantity(draft.quantity + 1)}><Plus aria-hidden /></button>
              </div>
            </div>
            <span className={styles.fact} data-tone={stockError || available === 0 ? 'danger' : undefined}>
              <span>{t('opo.available')}</span>
              <span data-testid="order-available">{available ?? '—'}</span>
            </span>
            <span className={styles.fact}>
              <span>{t('opo.weight')}</span>
              <span>{weightGrams === null ? '—' : kgLabel(weightGrams)}</span>
            </span>
          </div>
          {stockError ? (
            <p className={styles.error} id="order-qty-error" role="alert"><CircleX aria-hidden /><span>{t('opo.stockError', { count: available })}</span></p>
          ) : null}
        </div>
        <WeightNote price={price} weightGrams={weightGrams} initial={initial} />
      </div>

      <div className={styles.comment}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor="order-comment">{t('opw.comment')}</label>
          <span className={styles.labelNote}>{t('opw.commentToAttempt')}</span>
        </div>
        <textarea id="order-comment" className={styles.textarea} value={draft.comment} maxLength={500} onChange={(event) => onChange({ comment: event.target.value })} />
        <p className={styles.note}>{t('opw.helpTyping')}</p>
      </div>

      <p className={styles.ship} data-testid="order-ship">
        <Truck aria-hidden />
        <span>{rich(t(ship.today ? 'opo.shipToday' : 'opo.shipTomorrow'), { day: <strong>{t(ship.today ? 'opo.today' : 'opo.tomorrow', { date: dayLabel(`${ship.date}T12:00:00+05:00`) })}</strong> })}</span>
      </p>
    </div>
  );
}

/**
 * Og'irlik izohi (BUY-4, NRX-7): 3 kg gacha — tarif; og'irroq — formula; miqdor oshib yetkazish qayta
 * hisoblanganda — shu yetkazish turidagi eski va yangi summa (12, 13-kadrlar). Formula serverdan (`deliveryFormula`).
 */
function WeightNote({ price, weightGrams, initial }: { price: LeadPrice | null; weightGrams: number | null; initial: LeadPrice | null }) {
  const { t } = useTranslation();
  if (weightGrams === null) return null;
  const formula = price?.deliveryFormula ?? null;
  const base = formula?.baseWeightGrams ?? 3_000;
  const kg = <strong>{kgLabel(weightGrams)}</strong>;
  const baseKg = kgLabel(base);
  if (weightGrams <= base || !price || !formula) {
    return <Box tone={undefined} icon={<Scale aria-hidden />}>{rich(t('opo.weightLight'), { kg, base: baseKg })}</Box>;
  }
  const formulaText = `${formatMoney(formula.base)} + ${formula.extraKg} × ${formatMoney(formula.perExtraKg)}`;
  const feeNode = <strong>{sum(price.deliveryFee)}</strong>;
  const from = initial?.deliveryOptions?.[price.whereDeliver] ?? (initial?.whereDeliver === price.whereDeliver ? initial.deliveryFee : null);
  const heavier = initial?.weightGrams == null || weightGrams > initial.weightGrams;
  if (from !== null && from !== price.deliveryFee && heavier) {
    return (
      <Box tone="warning" icon={<TriangleAlert aria-hidden />} testId="weight-changed">
        {rich(t('opo.weightChanged'), { kg, from: formatMoney(from), fee: feeNode, formula: formulaText })}
      </Box>
    );
  }
  const where = t(`opw.whereDeliver.${price.whereDeliver}` as TranslationKey);
  return <Box tone="info" icon={<Scale aria-hidden />}>{rich(t('opo.weightHeavy'), { kg, base: baseKg, formula: formulaText, fee: feeNode, where })}</Box>;
}

function Box({ tone, icon, testId, children }: { tone: 'info' | 'warning' | undefined; icon: ReactNode; testId?: string; children: ReactNode }) {
  return (
    <div className={styles.box} data-tone={tone} data-testid={testId ?? 'weight-note'}>
      {icon}
      <span>{children}</span>
    </div>
  );
}
