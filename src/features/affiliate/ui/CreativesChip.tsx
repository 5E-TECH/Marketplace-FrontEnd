import { useTranslation } from '../../../shared/i18n/useTranslation';
import { creativeCounts } from '../lib/offerMath';

/** «1 video, 4 rasm» — offer rasmi ustida (joyi `className` da: karta yoki tafsilot). */
export function CreativesChip({ creatives, className }: { creatives: readonly { type: 'IMAGE' | 'VIDEO' }[]; className: string }) {
  const { t } = useTranslation();
  if (!creatives.length) return null;
  const label = t('offers.creatives', creativeCounts(creatives));
  const title = t('offers.creativesLabel', { list: label });
  return <span className={className} aria-label={title} title={title}>{label}</span>;
}
