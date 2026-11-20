import { Drawer, Skeleton } from 'antd';
import { CircleCheck, ExternalLink, PackageX, TriangleAlert, X } from 'lucide-react';
import { useLeadProductQuery } from '../../features/operator/api/operatorQueries';
import { sum } from '../../features/operator/lib/leadFormat';
import type { LeadCard } from '../../features/operator/model/operatorTypes';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import styles from './OperatorWorkspace.module.css';
import { Badge } from '../../shared/ui/Badge/Badge';

/**
 * «Mahsulot ma'lumoti» (operator-mahsulot): o'ngdagi panel, modal emas — lid kartasi va natijalar
 * ishlayveradi. Narx — lid sahifasidagi; qoldiq 0 bo'lsa operator tasdiqlashdan oldin ko'radi.
 */
export function ProductDrawer({ card, open, onClose }: { card: LeadCard; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const product = useLeadProductQuery(card.id, open);
  const info = product.data;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      mask={false}
      size="min(480px, 100vw)"
      rootClassName={styles.productDrawer}
      closable={false}
      footer={<div className={styles.drawerFooter}><button type="button" className={styles.secondaryButton} onClick={onClose}>{t('opw.close')}</button></div>}
    >
      <div className={styles.drawerHead}>
        <div>
          <small>{t('opw.productTitle', { id: card.id, name: card.customerName })}</small>
          <h2>{info?.name ?? card.product.name}</h2>
          {info?.category ? <p>{info.category}</p> : null}
        </div>
        <button type="button" className={styles.drawerClose} aria-label={t('opw.close')} onClick={onClose}><X size={18} aria-hidden /></button>
      </div>

      {product.isError && !info ? (
        <LoadError error={product.error} onRetry={() => void product.refetch()} />
      ) : !info ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div className={styles.productBody}>
          {info.imageUrl ? <img src={info.imageUrl} alt={info.name} style={{ width: '100%', borderRadius: 12 }} /> : null}

          <section>
            <h3>{t('opw.productPrice')} <span>{t('opw.productPriceNote')}</span></h3>
            <dl className={styles.priceBox}>
              <div><dt>{t('opw.sumGoods')}</dt><dd>{sum(info.salePrice)}</dd></div>
              <div>
                <dt>{t('opw.delivery')}</dt>
                <dd>{sum(info.deliveryFee.CENTER)} {t('opw.whereDeliver.CENTER')}<small>{t('opw.whereDeliver.ADDRESS')} {sum(info.deliveryFee.ADDRESS)}</small></dd>
              </div>
              <div>
                <dt>{t('opw.productTotal')}</dt>
                <dd data-total="true">{sum(info.salePrice + info.deliveryFee.CENTER)}<small>{t('opw.whereDeliver.ADDRESS')} {sum(info.salePrice + info.deliveryFee.ADDRESS)}</small></dd>
              </div>
              <div><dt>{t('opw.payLabelPlain')}</dt><dd>{t('opw.payValue')}</dd></div>
            </dl>
          </section>

          <section>
            <h3>{t('opw.productStock')}</h3>
            {info.available > 0 ? (
              <p className={styles.stockLine}>
                <Badge tone="success" icon={CircleCheck}>{t('opw.productInStock')}</Badge>
                <span>{t('opw.productAvailableBefore')} <strong>{t('opw.productAvailableCount', { count: info.available })}</strong> {t('opw.productAvailableAfter')}</span>
              </p>
            ) : (
              <div className={styles.notice} data-tone="danger"><PackageX aria-hidden /><div><strong>{t('opw.productOut')}</strong><p>{t('opw.productOutText')}</p></div></div>
            )}
          </section>

          {info.warning ? (
            <div className={styles.notice} data-tone="warning"><TriangleAlert aria-hidden /><div><p>{info.warning}</p></div></div>
          ) : null}

          {info.description || info.highlights.length ? (
            <section>
              <h3>{t('opw.productDescription')}</h3>
              {info.description ? <p>{info.description}</p> : null}
              {info.highlights.length ? <ul className={styles.bullets}>{info.highlights.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            </section>
          ) : null}

          <section>
            <h3>{t('opw.productInfoBlock')}</h3>
            <dl className={styles.infoRows}>
              {info.weightKg !== null ? <div><dt>{t('opw.productWeight')}</dt><dd>{t('opw.productWeightValue', { kg: info.weightKg })}</dd></div> : null}
              {info.contents ? <div><dt>{t('opw.productContents')}</dt><dd>{info.contents}</dd></div> : null}
            </dl>
          </section>

          <div className={styles.notice} data-tone="warning">
            <TriangleAlert aria-hidden />
            <div><strong>{t('opw.productDontPromise')}</strong><p>{t('opw.productDontPromiseText')}</p></div>
          </div>

          {info.pageUrl ? (
            <a className={styles.textLink} href={info.pageUrl} target="_blank" rel="noopener noreferrer">{t('opw.productPage')}<ExternalLink size={16} aria-hidden /></a>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
