import { ArrowRight, BookOpen } from 'lucide-react';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { DialogCancel, Dialog } from '../../../shared/ui/Dialog/Dialog';
import styles from './AdRules.module.css';

/** Asosiy reklama qoidalari va jazosi (sotuvchi-offer «Reklama qoidalari»; TZ 7, TZ 8, oferta). */
const RULES = ['quality', 'misleading', 'reviews', 'selfOrders'] as const;

export function AdRulesList() {
  const { t } = useTranslation();
  return (
    <ul className={styles.list}>
      {RULES.map((rule) => (
        <li key={rule}>
          <span>{t(`adRules.${rule}` as TranslationKey)}</span>
          <span className={styles.then}>
            <ArrowRight aria-hidden />
            {t(`adRules.${rule}Then` as TranslationKey)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * «Reklama qoidalari ›» (sotuvchi-offerlar): to'liq qoidalar sahifasi (`sotuvchi-reklama-qoidalari`) bu
 * kartada yo'q — asosiylari oynada.
 */
export function AdRulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} title={t('adRules.title')} description={t('adRules.intro')} icon={<BookOpen />} footer={<DialogCancel onClick={onClose}>{t('dialog.close')}</DialogCancel>}>
      <AdRulesList />
    </Dialog>
  );
}
