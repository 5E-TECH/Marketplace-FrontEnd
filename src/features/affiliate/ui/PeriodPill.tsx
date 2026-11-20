import { createPortal } from 'react-dom';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { usePageHeaderSlot } from '../../../shared/ui/PageHeader/pageTitle';
import { PillSelect } from '../../../shared/ui/PillSelect/PillSelect';
import { formatRange, PERIOD_PRESETS, periodRange, type PeriodPreset } from '../lib/statsPeriod';

/**
 * «Davr: Oxirgi 7 kun (08.01–14.01.2027)» — desktopda yuqori qatorda `h1` yonida (sotuvchi-statistika,
 * sotuvchi-offerlar); sarlavha joyi bo'lmasa (planshet, telefon) — shu yerning o'zida.
 */
export function PeriodPill({ today, period, onChange }: { today: string; period: PeriodPreset; onChange: (period: PeriodPreset) => void }) {
  const { t } = useTranslation();
  const headerSlot = usePageHeaderSlot();
  const pill = (
    <PillSelect
      label={t('sellerStats.period.label')}
      value={period}
      onChange={(value) => onChange(value as PeriodPreset)}
      options={PERIOD_PRESETS.map((preset) => {
        const range = periodRange(preset, today);
        return { value: preset, label: t('sellerStats.period.value', { name: t(`sellerStats.period.${preset}` as TranslationKey), range: formatRange(range.from, range.to) }) };
      })}
    />
  );
  return headerSlot ? createPortal(pill, headerSlot) : pill;
}
