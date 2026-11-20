import { CircleDot } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { isJustCreated, type StreamDisplayStatus } from '../lib/streamStatus';
import type { AffiliateStream } from '../model/offerTypes';
import styles from './StreamLink.module.css';

/** Sahifa holati va «hozir yaratildi» (sotuvchi-offerlar, sotuvchi-sahifalarim, sotuvchi-offer). */
export function StreamStatusBadges({ stream, status }: { stream: AffiliateStream; status: StreamDisplayStatus }) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());
  return (
    <span className={styles.badges}>
      <StatusBadge family="stream" code={status} />
      {status === 'ACTIVE' && isJustCreated(stream, now) ? <Badge tone="info" icon={CircleDot}>{t('streams.justCreated')}</Badge> : null}
    </span>
  );
}
