import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleMinus, CircleX, Clock, Info, Pencil, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { MoneyInput } from '../../../../shared/ui/MoneyInput/MoneyInput';
import { formatMoney } from '../../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../../shared/ui/StatusBadge/StatusBadge';
import { coefficients, markerAlign, priceScale, signedMoney } from '../../lib/pricingView';
import type { MarketCheckResult, PriceEvaluation, PriceStatus, ProductPricing } from '../../model/adminProductTypes';
import { REJECT_REASON_MAX } from '../adminProductModerationConfig';
import { ValueRow } from './PriceCalculation';
import styles from './Price.module.css';

const STATUSES: readonly PriceStatus[] = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];

/** Holat ikonkasi (admin-narx: holat bloki, shkala yorliqlari). */
const STATUS_ICON: Record<PriceStatus, LucideIcon> = { GREEN: CircleCheck, YELLOW: CircleAlert, ORANGE: TriangleAlert, RED: CircleX };

function StateIcon({ status }: { status: PriceStatus }) {
  const Icon = STATUS_ICON[status];
  return <Icon aria-hidden className={styles.stateIcon} />;
}

/** Shkala (admin-narx «Shkala»): to'rt bo'lak, chegaralar, yaxlit summalar va belgi. */
export function PriceScale({ calculation, price }: { calculation: ProductPricing['calculation']; price: number }) {
  const { t } = useTranslation();
  const m = (value: number) => formatMoney(value);
  const scale = priceScale(calculation, price);
  const { orangeFrom, yellowFrom, recommended } = calculation;
  return (
    <div>
      <p className={`${styles.stateLabel} ${styles.tight}`}>{t('anarx.scale.title')}</p>
      <div
        className={styles.scaleBox}
        role="img"
        aria-label={t('anarx.scale.aria', { orangeFrom: m(orangeFrom), orangeTo: m(yellowFrom - 1), yellowFrom: m(yellowFrom), yellowTo: m(recommended - 1), green: m(recommended), price: m(price) })}
        data-testid="price-scale"
      >
        <div className={styles.scaleTop}>
          <div className={styles.marker} data-align={markerAlign(scale.marker)} style={{ left: `calc(${scale.marker.toFixed(3)}% + 1px)` }}>
            <span>{m(price)}</span>
            <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden><path d="M0 0 H10 L5 6 Z" /></svg>
          </div>
        </div>
        <div className={styles.bar}>
          <div data-zone="RED" style={{ flexBasis: `${scale.red}%` }}><ChevronLeft aria-hidden /></div>
          <div data-zone="ORANGE" style={{ flexBasis: `${scale.orange.toFixed(3)}%` }} />
          <div data-zone="YELLOW" style={{ flexBasis: `${scale.yellow.toFixed(3)}%` }} />
          <div data-zone="GREEN"><ChevronRight aria-hidden /></div>
        </div>
        <div className={styles.scaleBottom}>
          {scale.ticks.map((tick) => <span key={tick} className={styles.tick} style={{ left: `${tick.toFixed(3)}%` }} />)}
          {[scale.red, scale.yellowAt, 100 - scale.green].map((bound, index) => <span key={index} className={styles.bound} style={{ left: `${bound.toFixed(3)}%` }} />)}
          <div className={styles.zoneLabel} data-zone="RED" data-side="right" style={{ right: `${100 - scale.red}%` }}>
            <span><CircleX aria-hidden />{t('status.price.RED')}</span><span>{`< ${m(orangeFrom)}`}</span>
          </div>
          <div className={styles.zoneLabel} data-zone="ORANGE" data-side="left" style={{ left: `${scale.red}%` }}>
            <span><TriangleAlert aria-hidden />{t('status.price.ORANGE')}</span><span>{`${m(orangeFrom)} – ${m(yellowFrom - 1)}`}</span>
          </div>
          <div className={styles.zoneLabel} data-zone="YELLOW" data-side="left" style={{ left: `${scale.yellowAt.toFixed(3)}%` }}>
            <span><CircleAlert aria-hidden />{t('status.price.YELLOW')}</span><span>{`${m(yellowFrom)} – ${m(recommended - 1)}`}</span>
          </div>
          <div className={styles.zoneLabel} data-zone="GREEN" data-side="right" style={{ right: 0 }}>
            <span><CircleCheck aria-hidden />{t('status.price.GREEN')}</span><span>{`≥ ${m(recommended)}`}</span>
          </div>
        </div>
        <div className={styles.zoneGrid}>
          <div data-zone="RED"><span><CircleX aria-hidden />{t('status.price.RED')}</span><span>{`< ${m(orangeFrom)}`}</span></div>
          <div data-zone="ORANGE"><span><TriangleAlert aria-hidden />{t('status.price.ORANGE')}</span><span>{`${m(orangeFrom)} – ${m(yellowFrom - 1)}`}</span></div>
          <div data-zone="YELLOW"><span><CircleAlert aria-hidden />{t('status.price.YELLOW')}</span><span>{`${m(yellowFrom)} – ${m(recommended - 1)}`}</span></div>
          <div data-zone="GREEN"><span><CircleCheck aria-hidden />{t('status.price.GREEN')}</span><span>{`≥ ${m(recommended)}`}</span></div>
        </div>
      </div>
    </div>
  );
}

/** «Holatlar — mijozga ko'rinadigan narxda» — joriy holat qatori ajratilgan. */
export function PriceLegend({ pricing, current }: { pricing: ProductPricing; current: PriceStatus | null }) {
  const { t } = useTranslation();
  const m = (value: number) => formatMoney(value);
  const { orangeFrom, yellowFrom, recommended } = pricing.calculation;
  const range: Record<PriceStatus, string> = {
    GREEN: t('anarx.legend.from', { from: m(recommended) }),
    YELLOW: t('anarx.legend.range', { from: m(yellowFrom), to: m(recommended - 1) }),
    ORANGE: t('anarx.legend.range', { from: m(orangeFrom), to: m(yellowFrom - 1) }),
    RED: t('anarx.legend.below', { to: m(orangeFrom) }),
  };
  return (
    <section className={styles.legend} data-testid="price-legend">
      <h4 className={styles.h4}>{t('anarx.legend.title')} <span>{t('anarx.legend.sub', { mode: t(`anarx.mode.${pricing.params.deliveryMode}` as TranslationKey) })}</span></h4>
      <ul>
        {STATUSES.map((status) => (
          <li key={status} data-current={status === current || undefined}>
            <span><StatusBadge family="price" code={status} /></span>
            <div>
              <p>{t(`anarx.legend.${status}` as TranslationKey)}</p>
              <p><strong>{t(`anarx.legend.${status}Rule` as TranslationKey)}</strong> {range[status]}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.legendNotes}>
        <p>{t('anarx.legend.k', { k70: m(pricing.params.kSale70), k100: m(pricing.params.kSale100) })}</p>
        <p>{t('anarx.legend.affiliate', { adCost: m(pricing.params.adCost) })}</p>
        <p>{t('anarx.legend.platform')}</p>
        <p>{t('anarx.legend.notify')}</p>
      </div>
    </section>
  );
}

/** Bozor narxi natijasi (holatlar 2.1, 2.2; bozor oynasida ham). */
export function MarketResult({ market, pricing, compact = false }: { market: MarketCheckResult; pricing: ProductPricing; compact?: boolean }) {
  const { t } = useTranslation();
  const m = (value: number) => formatMoney(value);
  const diff = market.ourTotal - market.competitorTotal;
  const { delivery, recommended } = pricing.calculation;
  const verdict = (
    <span className={styles.chip} data-tone={market.verdict === 'MOS' ? 'success' : 'warning'} data-testid="market-verdict">
      {market.verdict === 'MOS' ? <CircleCheck aria-hidden /> : <Clock aria-hidden />}
      {t(`anarx.market.${market.verdict}` as TranslationKey)}
    </span>
  );
  const rows = (
    <div className={styles.rows}>
      <ValueRow
        label={t('anarx.market.our')}
        value={t('anarx.sum', { amount: m(market.ourTotal) })}
        note={`${t('anarx.market.ourSub', { mode: t(`anarx.mode.${pricing.params.deliveryMode}` as TranslationKey), goods: m(recommended), delivery: m(delivery.visibleCenter) })} · ${diff < 0 ? t('anarx.market.cheaper', { diff: m(-diff) }) : diff > 0 ? t('anarx.market.dearer', { diff: m(diff) }) : t('anarx.market.equal')}`}
      />
      <ValueRow
        label={t('anarx.market.maxBase')}
        value={market.maxBasePrice === null ? '—' : t('anarx.sum', { amount: m(market.maxBasePrice) })}
        tone={market.verdict === 'QIMMAT' ? 'danger' : undefined}
        note={market.maxBasePrice === null
          ? t('anarx.market.noMax')
          : `${t('anarx.market.now', { base: m(pricing.calculation.basePrice) })} · ${t('anarx.market.maxNote', { m: m(pricing.params.targetMargin) })}`}
      />
    </div>
  );
  if (compact) return <div className={styles.resultBox}><p>{t('anarx.marketDialog.result')} {verdict}</p>{rows}</div>;
  return <div className={styles.marketResult} data-testid="market-result">{verdict}{rows}</div>;
}

interface PriceDecisionProps {
  pricing: ProductPricing;
  /** Kiritilgan narx holati (server hisobi); yangilanayotganda — oldingisi. */
  evaluation: PriceEvaluation | null;
  /** Tavsiya narxdagi natija («Kim qancha kam oladi» — dan). */
  atRecommended: { platformResult70: number; platformResult100: number } | null;
  price: number | null;
  onPrice: (value: number | null) => void;
  evaluating: boolean;
  reason: string;
  onReason: (value: string) => void;
  reasonError: boolean;
  approving: boolean;
  rejecting: boolean;
  /** Telefonda amallar pastki panelda. */
  phone: boolean;
  marketSaving: boolean;
  onMarket: (total: number) => void;
  onMarketDialog: () => void;
  onNegotiate: (presetReason: string) => void;
  onSafeFee: (fee: number) => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
}

/**
 * «Qaror — yakuniy narxni admin belgilaydi» (admin-narx; holatlar 1–2): admin narxi, holat, shkala, har tomon natijasi,
 * sariqda — kim qancha kam oladi, to'q sariq/qizilda — zararsiz taqsimot taklifi (NRX-13), bozor narxi (NRX-5), sabab
 * (to'q sariqda majburiy), «Narxni tasdiqlash» (qizilda yopiq), «Rad etish», holatlar izohi.
 */
export function PriceDecision(props: PriceDecisionProps) {
  const { pricing, evaluation, atRecommended, price, onPrice, evaluating, reason, onReason, reasonError, phone } = props;
  const { t } = useTranslation();
  const priceId = useId();
  const reasonId = useId();
  const marketId = useId();
  const [market, setMarket] = useState<number | null>(null);
  const m = (value: number) => formatMoney(value);
  const sum = (value: number) => t('anarx.sum', { amount: signedMoney(value) });
  const { params, calculation } = pricing;
  const c = coefficients(params);
  const status = evaluation?.status ?? null;
  const shown = evaluation?.price ?? price ?? calculation.recommended;
  const sumBF = calculation.basePrice + calculation.affiliateFee;
  const hidden = calculation.delivery.hidden;
  const formula = (k: number) => t(hidden > 0 ? 'anarx.results.pFormulaHidden' : 'anarx.results.pFormula', { at: c.at, price: m(shown), sum: m(sumBF), pay: c.payPct, k: m(k), hidden: m(hidden) });
  const mode = t(`anarx.mode.${params.deliveryMode}` as TranslationKey);
  const red = status === 'RED';
  const orange = status === 'ORANGE';
  const canApprove = Boolean(evaluation && price !== null && !red && !evaluating && !props.approving);
  const latestMarket = pricing.market ?? null;

  const elchiNote = params.deliveryMode === 'SEPARATE'
    ? t('anarx.results.elchiSeparate')
    : params.deliveryMode === 'FREE'
      ? t('anarx.results.elchiFree')
      : t('anarx.results.elchiPartial', { visible: m(calculation.delivery.visibleCenter), hidden: m(hidden) });

  const submitMarket = () => {
    if (market !== null && market > 0) props.onMarket(market);
  };

  const safe = evaluation && (orange || red) ? (
    evaluation.safeAffiliateFee !== null ? (
      <div className={styles.callout} data-tone="warning" data-testid="price-safe">
        <p><strong>{t('anarx.safe.title')}</strong> {t('anarx.safe.text', { fee: m(evaluation.safeAffiliateFee) })}</p>
        <p className={styles.note}>{t('anarx.safe.formula', { price: m(shown), base: m(calculation.basePrice), pay: c.payPct, k70: m(params.kSale70), hidden: hidden > 0 ? ` + ${m(hidden)}` : '', at: c.at })}</p>
        <div className={styles.calloutAction}>
          <button type="button" className={styles.secondaryButton} data-size="small" onClick={() => props.onSafeFee(evaluation.safeAffiliateFee ?? 0)}>
            {t('anarx.safe.action', { fee: m(evaluation.safeAffiliateFee) })}
          </button>
        </div>
      </div>
    ) : (
      <div className={styles.callout} data-tone="danger" data-testid="price-safe">
        <p><strong>{t('anarx.safe.none')}</strong></p>
        {evaluation.maxAffiliateFee !== undefined && evaluation.maxAffiliateFee !== null && evaluation.maxAffiliateFee > 0 ? (
          <>
            <p>{t('anarx.safe.noneText', { fee: m(evaluation.maxAffiliateFee), adCost: m(params.adCost) })}</p>
            <p className={styles.note}>{t('anarx.safe.formula', { price: m(shown), base: m(calculation.basePrice), pay: c.payPct, k70: m(params.kSale70), hidden: hidden > 0 ? ` + ${m(hidden)}` : '', at: c.at })}</p>
          </>
        ) : <p>{t('anarx.safe.noneEmpty')}</p>}
      </div>
    )
  ) : null;

  const actions: ReactNode = (
    <div className={styles.actions}>
      {red ? <p className={styles.blocked} role="alert">{t('anarx.action.redBlocked', { min: m(calculation.orangeFrom) })}</p> : null}
      {phone ? null : (
        <>
          <button type="button" className={styles.primary} disabled={!canApprove} onClick={props.onApprove} aria-label={t('anarx.action.approveAria', { price: m(shown) })}>
            {t('anarx.action.approve')}
            <kbd>{t('anarx.action.kbd')}</kbd>
          </button>
          <div className={styles.actionRow}>
            <button type="button" className={styles.rejectButton} disabled={props.rejecting} onClick={props.onReject}>{t('anarx.action.reject')}</button>
            <button type="button" className={styles.ghostButton} onClick={props.onCancel}>{t('anarx.action.cancel')}</button>
          </div>
        </>
      )}
      <div className={styles.actionNotes}>
        <p><Info aria-hidden />{t('anarx.action.note')}</p>
        <p><Info aria-hidden />{t('anarx.action.rejectNote')}</p>
      </div>
    </div>
  );

  return (
    <section className={styles.decision} aria-label={t('anarx.decision.title')} data-testid="price-decision">
      <p className={styles.sectionHead}><span>{t('anarx.decision.title')}</span> <span>{t('anarx.decision.sub')}</span></p>
      <div className={styles.decisionBody}>
        <h3 className={styles.h3}>{t('anarx.decision.price')} <span>{t('anarx.decision.priceSub', { mode })}</span></h3>
        <div className={styles.priceField}>
          <label htmlFor={priceId}>{t('anarx.decision.priceLabel')}</label>
          <div className={styles.priceLine}>
            <div className={styles.priceInput}>
              <MoneyInput id={priceId} size="large" value={price} onChange={onPrice} status={red ? 'error' : undefined} data-testid="admin-price" aria-describedby={red ? `${priceId}-floor` : undefined} />
            </div>
            <span className={styles.recommended}>{t('anarx.decision.recommended')} <strong>{t('anarx.sum', { amount: m(calculation.recommended) })}</strong></span>
          </div>
          {red ? <p className={styles.fieldError} id={`${priceId}-floor`}>{t('anarx.decision.belowFloor', { min: m(calculation.orangeFrom) })}</p> : null}
        </div>

        <div>
          <p className={styles.stateLabel}>{t('anarx.decision.state')}</p>
          <div className={styles.state} role="status" data-status={status ?? undefined} data-testid="price-state" aria-busy={evaluating || undefined}>
            {status ? <StateIcon status={status} /> : null}
            <div>
              <p>{status ? t(`status.price.${status}` as TranslationKey) : t('anarx.state.checking')}</p>
              {status ? <p>{t(`anarx.state.${status}` as TranslationKey)}</p> : null}
            </div>
          </div>
        </div>

        <PriceScale calculation={calculation} price={shown} />

        {evaluation ? (
          <div>
            <h4 className={styles.h4}>{t('anarx.results.title')}</h4>
            <p className={`${styles.note} ${styles.resultsNote}`}>{t('anarx.results.formula', { at: c.at, pay: c.payPct })}</p>
            <div className={`${styles.rows} ${styles.flush}`} data-testid="price-results">
              <ValueRow label={t('anarx.results.wholesaler')} value={sum(evaluation.split.wholesaler)} note={status === 'GREEN' ? undefined : t('anarx.results.unchanged')} />
              <ValueRow
                label={t('anarx.results.affiliate')}
                value={sum(evaluation.split.affiliate)}
                tone={evaluation.affiliateResult < 0 ? 'danger' : undefined}
                note={evaluation.affiliateResult < 0
                  ? t('anarx.results.loss', { loss: m(-evaluation.affiliateResult), adCost: m(params.adCost) })
                  : status === 'GREEN'
                    ? t('anarx.results.profit', { profit: m(evaluation.affiliateResult), adCost: m(params.adCost) })
                    : t('anarx.results.profitShort', { profit: m(evaluation.affiliateResult) })}
              />
              <ValueRow label={t('anarx.results.callCenter')} value={sum(evaluation.split.callCenter)} />
              <ValueRow label={t('anarx.results.p70')} value={sum(evaluation.platformResult70)} tone={evaluation.platformResult70 < 0 ? 'danger' : undefined} note={formula(params.kSale70)} />
              <ValueRow label={t('anarx.results.p100')} value={sum(evaluation.platformResult100)} tone={evaluation.platformResult100 < 0 ? 'danger' : undefined} note={formula(params.kSale100)} />
              <ValueRow label={t('anarx.results.elchi')} value={sum(calculation.delivery.tariffCenter)} note={elchiNote} />
            </div>
          </div>
        ) : null}

        {status === 'YELLOW' && atRecommended && evaluation ? (
          <div className={styles.callout} data-testid="price-less">
            <p><strong>{t('anarx.less.title')}</strong> {t('anarx.less.text')}</p>
            <div className={styles.rows}>
              <ValueRow label={t('anarx.less.p70')} value={t('anarx.less.value', { from: signedMoney(atRecommended.platformResult70), to: signedMoney(evaluation.platformResult70) })} note={t('anarx.less.sub')} />
              <ValueRow label={t('anarx.less.p100')} value={t('anarx.less.value', { from: signedMoney(atRecommended.platformResult100), to: signedMoney(evaluation.platformResult100) })} />
            </div>
          </div>
        ) : null}

        {safe}

        <div className={styles.market}>
          <label htmlFor={marketId}>{t('anarx.market.label')}</label>
          <div className={styles.marketLine}>
            <div className={styles.marketInput}>
              <MoneyInput
                id={marketId}
                value={market}
                onChange={setMarket}
                disabled={props.marketSaving}
                data-testid="market-input"
                placeholder=""
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submitMarket(); } }}
              />
            </div>
            {market !== null && market > 0 && market !== latestMarket?.competitorTotal ? (
              <button type="button" className={styles.secondaryButton} data-size="small" disabled={props.marketSaving} onClick={submitMarket}>{t('anarx.market.check')}</button>
            ) : latestMarket ? null : <span className={styles.chip}><CircleMinus aria-hidden />{t('anarx.market.none')}</span>}
            <button type="button" className={`${styles.link} ${styles.linkTall}`} onClick={props.onMarketDialog}><Pencil aria-hidden />{t('anarx.market.withSource')}</button>
          </div>
          {latestMarket ? (
            <>
              <MarketResult market={latestMarket} pricing={pricing} />
              <p className={styles.marketSource}>
                {t('anarx.market.source')} {latestMarket.source ? latestMarket.source : <span className={styles.muted}>{t('anarx.market.sourceNone')}</span>}
              </p>
              {latestMarket.verdict === 'QIMMAT' && latestMarket.maxBasePrice !== null ? (
                <div className={styles.marketActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    data-size="small"
                    onClick={() => props.onNegotiate(t('anarx.market.reasonPreset', { competitor: m(latestMarket.competitorTotal), our: m(latestMarket.ourTotal), max: m(latestMarket.maxBasePrice ?? 0) }))}
                  >
                    {t('anarx.market.negotiate')}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className={styles.reason}>
          <div>
            <label htmlFor={reasonId}>{t('anarx.reason.label')}{orange ? <> <span>{t('anarx.reason.required')}</span></> : null}</label>
            {orange ? null : <span>{t('anarx.reason.hint')}</span>}
          </div>
          <textarea
            id={reasonId}
            className={styles.textarea}
            value={reason}
            maxLength={REJECT_REASON_MAX}
            aria-invalid={reasonError || undefined}
            aria-describedby={reasonError ? `${reasonId}-error` : undefined}
            onChange={(event) => onReason(event.target.value)}
            data-testid="price-reason"
          />
          {reasonError ? <p className={styles.fieldError} id={`${reasonId}-error`} role="alert">{t('anarx.reason.error')}</p> : null}
          {orange ? (
            <>
              <div className={styles.presets}>
                <button type="button" className={styles.secondaryButton} data-size="small" onClick={() => onReason(t('anarx.reason.preset'))}>{t('anarx.reason.preset')}</button>
              </div>
              <p className={styles.note}>{t('anarx.reason.superadmin')}</p>
            </>
          ) : null}
        </div>

        {actions}

        <PriceLegend pricing={pricing} current={status} />
      </div>
    </section>
  );
}
