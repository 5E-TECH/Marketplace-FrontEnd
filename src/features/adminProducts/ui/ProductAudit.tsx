import { useTranslation } from '../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../shared/lib/personName';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { useProductAuditQuery } from '../api/adminProductsQueries';
import { auditChange, formatStamp } from '../lib/productFormat';
import styles from './ProductAudit.module.css';

/** Tashkilot nomi («Namuna Savdo MChJ») qisqartirilmaydi — faqat odam ismi («Nodira K.»). */
const LEGAL_FORM = /(^|\s)(MChJ|XK|YaTT|AJ|QK|OOO|LLC)(\s|$)/i;

/**
 * «Audit — shu mahsulot» (admin-moderatsiya; mahsulot kartasidagi «Audit» yorlig'i): qachon, kim, o'zgarish.
 * Desktop va planshetda jadval, telefonda yozuvlar ro'yxati. Taklif (3-bo'lim): `entityId` filtri.
 */
export function ProductAudit({ productId, phone }: { productId: string; phone: boolean }) {
  const { t } = useTranslation();
  const audit = useProductAuditQuery(productId);
  const who = (name: string | null) => (!name ? t('moderation.audit.system') : LEGAL_FORM.test(name) ? name : shortPersonName(name));

  return (
    <section className={styles.audit} aria-labelledby={`audit-${productId}`} data-testid="product-audit">
      <h3 id={`audit-${productId}`} className={styles.title}>
        {t('moderation.audit')} <span>{t('moderation.auditHint')}</span>
      </h3>
      <p className={styles.hint}>{t('moderation.auditText')}</p>
      {audit.isError ? (
        <div className={styles.state}>
          <LoadError error={audit.error} onRetry={() => void audit.refetch()} variant="row" title={t('moderation.audit.error')} />
        </div>
      ) : audit.data && !audit.data.length ? (
        <p className={styles.empty}>{t('moderation.audit.empty')}</p>
      ) : phone ? (
        <ul className={styles.list}>
          {(audit.data ?? []).map((entry) => (
            <li key={entry.id}>
              <span className={styles.listHead}>
                <strong>{who(entry.actorName)}</strong>
                <span>{formatStamp(entry.at)}</span>
              </span>
              <span>{auditChange(entry, t)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-busy={audit.isPending || undefined}>
            <thead>
              <tr>
                <th>{t('moderation.audit.when')}</th>
                <th>{t('moderation.audit.who')}</th>
                <th>{t('moderation.audit.what')}</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data ?? []).map((entry) => (
                <tr key={entry.id}>
                  <td>{formatStamp(entry.at)}</td>
                  <td>{who(entry.actorName)}</td>
                  <td>{auditChange(entry, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
