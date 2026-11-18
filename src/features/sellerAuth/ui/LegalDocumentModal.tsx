import { Button, Select } from 'antd';
import { useRef } from 'react';
import type { LegalDocument } from '../api/sellerAuthApi';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../../shared/lib/tashkentTime';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import formStyles from '../../../shared/ui/AuthLayout/authForm.module.css';
import { SheetModal } from '../../../shared/ui/SheetModal/SheetModal';
import styles from './LegalDocumentModal.module.css';

interface LegalDocumentModalProps {
  /** `null` — oyna yopiq. */
  document: LegalDocument | null;
  onClose: () => void;
  /** «Qabul qilaman» / «Roziman» — tegishli belgi qo'yiladi. Berilmasa (Profil) — faqat «Yopish». */
  onAccept?: (type: LegalDocument['type']) => void;
}

/**
 * Oferta to'liq matni (720 px, chapda mundarija) va rozilik matni (480 px) — sotuvchi-royxat §4.
 * Telefonda mundarija «Bo‘lim» tanloviga aylanadi. Matnni yurist tayyorlaydi (EQ-10).
 */
export function LegalDocumentModal({ document, onClose, onAccept }: LegalDocumentModalProps) {
  const { t } = useTranslation();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const bodyRef = useRef<HTMLDivElement>(null);
  const isOffer = document?.type === 'affiliate-offer';

  const scrollTo = (id: string) => {
    bodyRef.current?.querySelector<HTMLElement>(`[data-section="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // Sarlavhalar raqami bilan keladi («1. Atamalar va taraflar») — matn yuristniki (EQ-10).
  const sections = document?.sections.map((section) => ({ ...section, label: section.title })) ?? [];

  return (
    <SheetModal
      open={document !== null}
      width={isOffer ? 720 : 480}
      rootClassName={phone ? styles.phone : undefined}
      title={
        document ? (
          <span className={styles.modalTitle}>
            <span>{isOffer ? t('register.offerDoc') : t('register.consentTitle')}</span>
            <span className={styles.modalMeta}>
              {isOffer
                ? t('register.offerMeta', {
                    version: document.version,
                    date: document.effectiveAt ? tashkentDateTime(document.effectiveAt).slice(0, 10) : t('register.datePending'),
                  })
                : t('register.consentMeta', { version: document.version })}
            </span>
          </span>
        ) : null
      }
      onCancel={onClose}
      footer={
        document ? (
          <div className={onAccept ? styles.modalActions : styles.modalActionsSingle}>
            <Button className={formStyles.secondary} onClick={onClose}>{t('register.close')}</Button>
            {onAccept ? (
              <Button className={formStyles.secondary} type="primary" onClick={() => onAccept(document.type)}>
                {isOffer ? t('register.accept') : t('register.agree')}
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      {document && isOffer ? (
        <div className={styles.offerLayout}>
          {phone ? (
            <Select
              className={styles.sectionSelect}
              aria-label={t('register.section')}
              placeholder={t('register.section')}
              options={sections.map((section) => ({ value: section.id, label: section.label }))}
              onChange={(value: string) => scrollTo(value)}
            />
          ) : (
            <nav className={styles.toc} aria-label={t('register.sections')}>
              <p className={styles.tocTitle}>{t('register.toc')}</p>
              <ul>
                {sections.map((section) => (
                  <li key={section.id}>
                    <button type="button" onClick={() => scrollTo(section.id)}>{section.label}</button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div ref={bodyRef} className={styles.documentBody} role="document" aria-label={t('register.offerText')} tabIndex={0}>
            {document.summary.length ? (
              <section className={styles.documentSummary}>
                <h3>{t('register.summaryShort')}</h3>
                <ul>
                  {document.summary.map((item) => (
                    <li key={item.term}><strong>{item.term}</strong> {item.text}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {sections.map((section) => (
              <section key={section.id} data-section={section.id} className={styles.documentSection}>
                <h3>{section.label}</h3>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      ) : document ? (
        <dl className={styles.consentList}>
          {sections.map((section) => (
            <div key={section.id}>
              <dt>{section.title}</dt>
              <dd>{section.body}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </SheetModal>
  );
}
