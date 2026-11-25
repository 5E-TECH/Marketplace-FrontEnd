import { ChevronRight, CircleMinus, ReceiptText, TriangleAlert, Undo2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminShipmentPath } from '../../../features/inbound/lib/shipmentLabels';
import type { WholesalerAttention } from '../../../features/wholesalers/model/wholesalerTypes';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatCsvDate } from '../../../shared/lib/csv';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { cardPath } from '../model/wholesalerList';
import styles from './WholesalersTab.module.css';

type T = ReturnType<typeof useTranslation>['t'];

const ICONS: Record<WholesalerAttention['kind'], { icon: LucideIcon; tone: 'warning' | 'neutral' | 'info' }> = {
  SHIPMENT_DEFECT: { icon: TriangleAlert, tone: 'warning' },
  OUT_OF_STOCK: { icon: CircleMinus, tone: 'neutral' },
  DEFECT_NOT_RETURNED: { icon: Undo2, tone: 'warning' },
  SETTLEMENT_READY: { icon: ReceiptText, tone: 'info' },
};

/** «Diqqat talab qiladi» qatori: sarlavha, izoh va qayerga o'tish (postavka, qoldiq, aktlar, karta). */
function view(item: WholesalerAttention, t: T): { title: string; text: string; link: string; to: string; tbd?: boolean } {
  switch (item.kind) {
    case 'SHIPMENT_DEFECT':
      return {
        title: t('whs.att.defectTitle', { code: item.shipmentCode, product: item.productName, count: item.defect }),
        text: t('whs.att.defectText', { declared: item.declared, received: item.received, defect: item.defect }),
        link: t('whs.att.defectLink'),
        to: adminShipmentPath(item.shipmentId),
      };
    case 'OUT_OF_STOCK': {
      const base = item.onHand > 0 ? t('whs.att.stockReserved', { count: item.onHand }) : t('whs.att.stockEmpty');
      const incoming = item.incomingCode ? ` ${t('whs.att.stockIncoming', { code: item.incomingCode, count: item.incomingQty })}` : '';
      return { title: t('whs.att.stockTitle', { product: item.productName }), text: base + incoming, link: t('whs.att.stockLink'), to: '/admin/inventory' };
    }
    case 'DEFECT_NOT_RETURNED': {
      const parts = [
        item.fromReceiving ? t('whs.att.returnReceiving', { count: item.fromReceiving, codes: item.receivingCodes.join(', ') }) : null,
        item.fromReturns ? t('whs.att.returnReturns', { count: item.fromReturns, codes: item.returnCodes.join(', ') }) : null,
      ].filter(Boolean);
      return {
        title: t('whs.att.returnTitle', { count: item.quantity }),
        text: `${parts.join(', ')}. ${t('whs.att.returnRule')}`,
        link: t('whs.att.returnLink'),
        to: `${cardPath(item.wholesalerId)}?tab=returns`,
        tbd: true,
      };
    }
    case 'SETTLEMENT_READY':
      return {
        title: t('whs.att.actTitle', { code: item.code }),
        text: t('whs.att.actText', { from: formatCsvDate(item.periodFrom).slice(0, 5), to: formatCsvDate(item.periodTo), amount: formatMoney(item.amount) }),
        link: t('whs.att.actLink'),
        to: `${cardPath(item.wholesalerId)}?tab=money`,
      };
  }
}

export function AttentionCard({ items }: { items: readonly WholesalerAttention[] }) {
  const { t } = useTranslation();
  const names = [...new Set(items.map((item) => item.wholesalerName))].join(', ');
  return (
    <section className={`${styles.card} ${styles.attention}`} aria-labelledby="whs-attention" data-testid="wholesaler-attention">
      <div className={styles.cardHead}>
        <h2 id="whs-attention">{t('whs.att.title')}</h2>
        {items.length ? <span className={styles.cardSub}>{t('whs.att.sub', { names, count: items.length })}</span> : null}
      </div>
      {items.length ? (
        <ul className={styles.attentionList}>
          {items.map((item) => {
            const { icon: Icon, tone } = ICONS[item.kind];
            const row = view(item, t);
            return (
              <li key={item.id}>
                <span className={styles.attentionIcon} data-tone={tone}><Icon aria-hidden /></span>
                <div className={styles.attentionBody}>
                  <p className={styles.attentionTitle}>{row.title}</p>
                  <p className={styles.attentionText}>{row.text}{row.tbd ? <> <span>{t('whs.tbd')}</span></> : null}</p>
                </div>
                <div className={styles.attentionLink}>
                  <Link to={row.to}>{row.link}<ChevronRight aria-hidden /></Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.cardSub}>{t('whs.att.empty')}</p>
      )}
    </section>
  );
}

/** «Optovik qanday ishga tushadi» — 5 qadam (pilotda admin, M2 da optovik o'zi). */
export function LaunchSteps() {
  const { t } = useTranslation();
  return (
    <section className={`${styles.card} ${styles.steps}`} aria-labelledby="whs-steps">
      <div className={styles.cardHead}>
        <h2 id="whs-steps">{t('whs.steps.title')}</h2>
        <span className={styles.cardSub}>{t('whs.steps.sub')}</span>
      </div>
      <ol className={styles.stepList}>
        {([1, 2, 3, 4, 5] as const).map((step) => (
          <li key={step}>
            <span className={styles.stepNumber}>{step}</span>
            <span className={styles.stepBody}>
              <span className={styles.stepTitle}>{t(`whs.steps.${step}`)}</span>
              <span className={styles.stepText}>{t(`whs.steps.${step}.text`)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
