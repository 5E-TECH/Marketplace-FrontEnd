import { useTranslation } from '../../i18n/useTranslation';
import { Badge } from '../Badge/Badge';
import { STATUS_FAMILIES, statusKey, TONE_ICON, type StatusCode, type StatusEntry, type StatusFamily } from './statusConfig';

interface StatusBadgeProps<F extends StatusFamily> {
  family: F;
  code: StatusCode<F>;
  /** Maslahat matni boshi: «Lid holati» → «Lid holati: Bronda». */
  titlePrefix?: string;
}

/** Holat belgisi oila va kod bo'yicha: rang, ikonka va nom bitta jadvaldan (komponentlar-E §1, §33). */
export function StatusBadge<F extends StatusFamily>({ family, code, titlePrefix }: StatusBadgeProps<F>) {
  const { t } = useTranslation();
  const entry = (STATUS_FAMILIES[family] as Record<string, StatusEntry>)[code];
  const label = t(statusKey(family, code));
  return (
    <Badge tone={entry.tone} icon={entry.icon ?? TONE_ICON[entry.tone]} title={titlePrefix ? `${titlePrefix}: ${label}` : undefined}>
      {label}
    </Badge>
  );
}

