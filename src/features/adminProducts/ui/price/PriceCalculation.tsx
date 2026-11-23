import { Check, Lock, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { formatMoney } from '../../../../shared/ui/MoneyText/formatMoney';
import { coefficients, shareLabel, signedMoney } from '../../lib/pricingView';
import type { DeliveryMode, ProductPricing } from '../../model/adminProductTypes';
import styles from './Price.module.css';

const MODES: readonly DeliveryMode[] = ['SEPARATE', 'PARTIAL', 'FREE'];

/** Nom | summa qatori, ostida ixtiyoriy formula izohi. */
export function ValueRow({ label, value, note, strong = false, action, tone }: { label: ReactNode; value: ReactNode; note?: ReactNode; strong?: boolean; action?: ReactNode; tone?: 'danger' }) {
  return (
    <div className={styles.row} data-strong={strong || undefined}>
      <span>{label}</span>
      <span className={styles.rowValue}>{action}<strong data-tone={tone}>{value}</strong></span>
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  );
}

interface PriceCalculationProps {
  pricing: ProductPricing;
  /** Qaror bilan saqlanadigan yangi haq (hali saqlanmagan). */
  feeDraft: number | null;
  /** Yetkazish rejimi o'zgartirilmoqda (PUT price-policy). */
  modeSaving: boolean;
  readOnly: boolean;
  /** Telefon (admin-narx.mobil): taqsimot va rejimlar — ikki ustunli ro'yxat. */
  phone: boolean;
  onChangeFee: () => void;
  onMode: (mode: DeliveryMode) => void;
}

/**
 * «Hisob — tizim tavsiya narxni hisoblaydi» (admin-narx): kalkulyator (tavsiya, zararsizlik, qat'iy chegara, natija,
 * ulush), hisobdagi qiymatlar, taqsimot (tavsiya narxda, alohida rejim asosi), yetkazishni ko'rsatish va rejimlar
 * solishtiruvi. Hamma son — serverdan (BE-09); bu yerda faqat formula izohlari yoziladi.
 */
export function PriceCalculation({ pricing, feeDraft, modeSaving, readOnly, phone, onChangeFee, onMode }: PriceCalculationProps) {
  const { t } = useTranslation();
  const { params, calculation } = pricing;
  const { delivery } = calculation;
  const c = coefficients(params);
  const sum = (value: number) => t('anarx.sum', { amount: signedMoney(value) });
  const m = (value: number) => formatMoney(value);
  const base = calculation.basePrice;
  const fee = calculation.affiliateFee;
  const sumBF = base + fee;
  const recBase = calculation.recommendedBase;
  const service = recBase - base - fee - params.callCenterFee;
  const separateResult = pricing.modes?.find((row) => row.mode === 'SEPARATE')?.platformResult70;
  const modeName = (mode: DeliveryMode) => t(`anarx.modeName.${mode}` as TranslationKey);
  const source = params.deliveryModeSource ?? 'GLOBAL';
  const tariffKg = String(pricing.tariff.baseWeightGrams / 1000);

  const splitRows = [
    { key: 'wholesaler', kind: 'part', name: t('anarx.split.wholesaler'), sub: t('anarx.split.wholesalerTo'), value: m(base), share: shareLabel(base, recBase) },
    { key: 'affiliate', kind: 'part', name: t('anarx.split.affiliate'), sub: t('anarx.split.affiliateTo'), value: m(fee), share: shareLabel(fee, recBase) },
    { key: 'callCenter', kind: 'part', name: t('anarx.split.callCenter'), sub: t('anarx.split.callCenterTo'), value: m(params.callCenterFee), share: shareLabel(params.callCenterFee, recBase) },
    { key: 'service', kind: 'divider', name: t('anarx.split.service'), sub: t('anarx.split.serviceTo'), value: signedMoney(service), share: shareLabel(service, recBase) },
    { key: 'goods', kind: 'strong', name: t('anarx.split.goods'), sub: null, value: m(recBase), share: '100%' },
    { key: 'delivery', kind: 'plain', name: t('anarx.split.delivery'), sub: t('anarx.split.deliveryTo'), value: m(delivery.tariffCenter), share: '—' },
    { key: 'total', kind: 'total', name: t('anarx.split.total'), sub: t('anarx.split.totalSub'), value: m(recBase + delivery.tariffCenter), share: null },
  ];

  return (
    <section className={styles.calc} aria-label={t('anarx.calc.title')} data-testid="price-calculation">
      <p className={styles.sectionHead}><span>{t('anarx.calc.title')}</span> <span>{t('anarx.calc.sub')}</span></p>
      <div className={styles.calcBody}>
        <section>
          <h3 className={styles.h3}>{t('anarx.calc.calculator')} <span>{t('anarx.calc.calculatorSub')}</span></h3>
          <div className={styles.rows}>
            <ValueRow label={t('anarx.calc.base')} value={sum(base)} />
            <ValueRow
              label={t('anarx.calc.fee')}
              value={sum(fee)}
              action={readOnly ? undefined : <button type="button" className={styles.link} onClick={onChangeFee}><Pencil aria-hidden />{t('anarx.calc.change')}</button>}
              note={feeDraft !== null
                ? t('anarx.calc.feeDraft', { fee: m(pricing.recommendedAffiliateFee) })
                : t('anarx.calc.feeNote', { adCost: m(params.adCost), coef: String(params.affiliateCoef) })}
            />
            <ValueRow
              strong
              label={t('anarx.calc.recommended')}
              value={sum(recBase)}
              note={t('anarx.calc.recommendedFormula', {
                at: c.at, sum: m(sumBF), k70: m(params.kSale70), m: m(params.targetMargin), net: c.net,
                exact: calculation.recommendedBaseExact === undefined ? '' : ` = ${m(calculation.recommendedBaseExact)}`,
              })}
            />
            <ValueRow label={t('anarx.calc.breakeven')} value={sum(calculation.breakevenBase)} note={t('anarx.calc.breakevenFormula', { at: c.at, sum: m(sumBF), k70: m(params.kSale70), net: c.net })} />
            <ValueRow label={t('anarx.calc.floor')} value={sum(calculation.hardFloorBase)} note={t('anarx.calc.floorFormula', { at: c.at, sum: m(sumBF), k100: m(params.kSale100), net: c.net })} />
            {separateResult === undefined ? null : (
              <ValueRow
                label={t('anarx.calc.result')}
                value={sum(separateResult)}
                tone={separateResult < 0 ? 'danger' : undefined}
                note={t('anarx.calc.resultFormula', { at: c.at, price: m(recBase), sum: m(sumBF), pay: c.payPct, k70: m(params.kSale70) })}
              />
            )}
            <ValueRow
              label={t('anarx.calc.share')}
              value={`${calculation.platformSharePercent.toFixed(1)}%`}
              note={t('anarx.calc.shareFormula', { callCenter: m(params.callCenterFee), service: signedMoney(service), price: m(recBase) })}
            />
          </div>
          <div className={styles.values}>
            <p>{t('anarx.calc.values')}</p>
            <dl>
              <dt>{m(sumBF)}</dt><dd>{t('anarx.calc.valueSum')}</dd>
              <dt>{m(params.kSale70)}</dt><dd>{t('anarx.calc.valueK70')}</dd>
              <dt>{m(params.kSale100)}</dt><dd>{t('anarx.calc.valueK100')}</dd>
              <dt>{m(params.targetMargin)}</dt><dd>{t('anarx.calc.valueM')}</dd>
              <dt>{c.at}</dt><dd>{t('anarx.calc.valueAt', { tax: c.tax, taxPct: c.taxPct })}</dd>
              <dt>{c.net}</dt><dd>{t('anarx.calc.valueNet', { tax: c.tax, pay: c.pay, taxPct: c.taxPct, payPct: c.payPct })}</dd>
            </dl>
            <p className={styles.valuesNote}><Lock aria-hidden /><span>{t('anarx.calc.valuesNote', { coef: String(params.affiliateCoef) })}</span></p>
          </div>
        </section>

        <section>
          <h3 className={styles.h3}>{t('anarx.split.title')} <span>{t('anarx.split.sub')}</span></h3>
          <p className={styles.note}>{t(phone ? 'anarx.split.notePhone' : 'anarx.split.note')}</p>
          {phone ? (
            <div className={styles.list} data-testid="price-split">
              {splitRows.map((row) => (
                <div key={row.key} className={styles.listRow} data-kind={row.kind}>
                  <span><span>{row.name}</span>{row.sub ? <span>{row.sub}</span> : null}</span>
                  <span><span>{row.value}</span>{row.share ? <span>{row.share}</span> : null}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.tableBox}>
              <table className={styles.table} data-testid="price-split">
                <thead>
                  <tr>
                    <th>{t('anarx.split.colPart')}</th>
                    <th>{t('anarx.split.colSum')}</th>
                    <th>{t('anarx.split.colShare')}</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['anarx.split.wholesaler', 'anarx.split.wholesalerTo', base],
                    ['anarx.split.affiliate', 'anarx.split.affiliateTo', fee],
                    ['anarx.split.callCenter', 'anarx.split.callCenterTo', params.callCenterFee],
                    ['anarx.split.service', 'anarx.split.serviceTo', service],
                  ] as const).map(([name, to, value], index) => (
                    <tr key={name} data-divider={index === 3 || undefined}>
                      <td><span className={styles.cellName}>{t(name)}</span><span className={styles.cellSub}>{t(to)}</span></td>
                      <td>{signedMoney(value)}</td>
                      <td>{shareLabel(value, recBase)}</td>
                    </tr>
                  ))}
                  <tr data-strong>
                    <td>{t('anarx.split.goods')}</td>
                    <td>{m(recBase)}</td>
                    <td>100%</td>
                  </tr>
                  <tr>
                    <td><span className={`${styles.cellName} ${styles.regular}`}>{t('anarx.split.delivery')}</span><span className={styles.cellSub}>{t('anarx.split.deliveryTo')}</span></td>
                    <td>{m(delivery.tariffCenter)}</td>
                    <td className={styles.dash}>—</td>
                  </tr>
                  <tr data-total>
                    <td><span className={`${styles.cellName} ${styles.bold}`}>{t('anarx.split.total')}</span><span className={styles.cellSub}>{t('anarx.split.totalSub')}</span></td>
                    <td>{m(recBase + delivery.tariffCenter)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className={`${styles.note} ${styles.below}`}>{t('anarx.split.formula', { price: m(recBase), base: m(base), fee: m(fee), callCenter: m(params.callCenterFee) })}</p>
        </section>

        <section>
          <h3 className={styles.h3}>{t('anarx.delivery.title')}</h3>
          <p className={styles.fieldLabel} id="price-mode-label">{t('anarx.delivery.mode')}</p>
          <div className={styles.modeRow}>
            <div className={styles.segmented} role="radiogroup" aria-labelledby="price-mode-label" aria-busy={modeSaving || undefined}>
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={params.deliveryMode === mode}
                  disabled={readOnly || modeSaving}
                  onClick={() => { if (mode !== params.deliveryMode) onMode(mode); }}
                >
                  {modeName(mode)}
                </button>
              ))}
            </div>
            <span>{t(`anarx.delivery.source.${source}` as TranslationKey, { mode: t(`anarx.mode.${params.deliveryMode}` as TranslationKey) })}</span>
          </div>
          <div className={styles.scroll}>
            <table className={styles.plain}>
              <thead>
                <tr>
                  <th><span className={styles.visuallyHidden}>{t('anarx.delivery.part')}</span></th>
                  <th>{t('anarx.delivery.center')}</th>
                  <th>{t('anarx.delivery.address')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t('anarx.delivery.visible')}</td>
                  <td>{sum(delivery.visibleCenter)}</td>
                  <td>{sum(delivery.visibleAddress)}</td>
                </tr>
                <tr data-divider>
                  <td>{t('anarx.delivery.hidden')}<p className={styles.note}>{t('anarx.delivery.hiddenNote')}</p></td>
                  <td>{sum(delivery.hidden)}</td>
                  <td>{sum(delivery.tariffAddress - delivery.visibleAddress)}</td>
                </tr>
                <tr data-strong>
                  <td>{t('anarx.delivery.tariff', { kg: tariffKg })}</td>
                  <td>{sum(delivery.tariffCenter)}</td>
                  <td>{sum(delivery.tariffAddress)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={`${styles.note} ${styles.below}`}>
            {delivery.hidden > 0
              ? t('anarx.delivery.formula', { hidden: m(delivery.hidden), net: c.net, add: m(delivery.hiddenPriceAdd), base: m(recBase), total: m(calculation.recommended) })
              : t('anarx.delivery.formulaNone', { price: m(calculation.recommended) })}
          </p>
          {pricing.modes?.length ? (
            <>
              {phone ? (
                <>
                  <p className={styles.listTitle}>{t('anarx.modes.phoneTitle')} <span>{t('anarx.modes.phoneSub')}</span></p>
                  <div className={styles.list} data-testid="price-modes">
                    {pricing.modes.map((row) => (
                      <div key={row.mode} className={styles.listRow} data-current={row.mode === params.deliveryMode || undefined}>
                        <span>
                          <span className={row.mode === params.deliveryMode ? styles.current : undefined}>{row.mode === params.deliveryMode ? <Check aria-hidden /> : null}{modeName(row.mode)}</span>
                          <span>{row.delivery > 0 ? t('anarx.modes.line', { goods: m(row.goodsPrice), delivery: m(row.delivery) }) : t('anarx.modes.lineFree', { goods: m(row.goodsPrice) })}</span>
                        </span>
                        <span><span>{m(row.customerTotal)}</span><span>{t('anarx.modes.result', { value: signedMoney(row.platformResult70) })}</span></span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                  <div className={`${styles.tableBox} ${styles.gap16}`}>
                    <table className={styles.table} data-testid="price-modes">
                      <thead>
                        <tr>
                          <th>{t('anarx.modes.colMode')}</th>
                          <th>{t('anarx.modes.colTotal')}</th>
                          <th>{t('anarx.modes.colResult')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricing.modes.map((row) => (
                          <tr key={row.mode} data-current={row.mode === params.deliveryMode || undefined}>
                            <td>
                              <span className={`${styles.cellName} ${row.mode === params.deliveryMode ? styles.current : ''}`}>{row.mode === params.deliveryMode ? <Check aria-hidden /> : null}{modeName(row.mode)}</span>
                              <span className={styles.cellSub}>
                                {row.delivery > 0
                                  ? t('anarx.modes.line', { goods: m(row.goodsPrice), delivery: m(row.delivery) })
                                  : t('anarx.modes.lineFree', { goods: m(row.goodsPrice) })}
                              </span>
                            </td>
                            <td>{m(row.customerTotal)}</td>
                            <td>{signedMoney(row.platformResult70)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              )}
              <p className={`${styles.note} ${styles.below}`}>{t('anarx.modes.note')}</p>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
