import { Copy, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { CodeBadge } from '../../../shared/ui/Badge/Badge';
import { splitStreamLink } from '../lib/streamLink';
import { useCopyLink } from './useCopyLink';
import styles from './StreamLink.module.css';

/** Katta havola qutisi («Sahifa tayyor»): domen kulrang, kod qalin; tor joyda uchi «…». */
export function StreamLinkBox({ link, size = 'lg' }: { link: string; size?: 'lg' | 'md' }) {
  const { domain, code } = splitStreamLink(link);
  return (
    <div className={styles.box} data-size={size} data-testid="stream-link">
      <span className={styles.boxText}>
        {domain ? <span className={styles.domain}>{domain}</span> : null}
        {domain ? '/' : null}
        <span className={styles.code}>{code}</span>
      </span>
    </div>
  );
}

/** Jadvaldagi havola: «domen/» kulrang + kod belgisi (sotuvchi-offerlar, sotuvchi-offer). */
export function StreamLinkInline({ link }: { link: string }) {
  const { domain, code } = splitStreamLink(link);
  return (
    <span className={styles.inline}>
      {domain ? <span className={styles.domain}>{domain}/</span> : null}
      <CodeBadge>{code}</CodeBadge>
    </span>
  );
}

interface LinkButtonProps {
  link: string;
  /** `lg` — 52 («Sahifa tayyor»), `md` — 44. */
  size?: 'lg' | 'md';
  block?: boolean;
}

interface CopyLinkButtonProps extends LinkButtonProps {
  /** `plain` — oddiy (kulrang chegara): telefonda sahifa kartasida (sotuvchi-sahifalarim .mobil). */
  tone?: 'action' | 'plain';
}

/** «Nusxa olish» — ko'k chiziqli (asosiy amal yonida yagona ko'k). */
export function CopyLinkButton({ link, size = 'lg', block, tone = 'action' }: CopyLinkButtonProps) {
  const { t } = useTranslation();
  const copy = useCopyLink();
  return (
    <button type="button" className={styles.button} data-tone={tone === 'action' ? 'action' : undefined} data-size={size} data-block={block || undefined} onClick={() => void copy(link)}>
      <Copy aria-hidden />
      {t('copy.copy')}
    </button>
  );
}

/** «Ochib ko‘rish» — sotuvchi sahifasi yangi tabda (FE-05 TC3). */
export function OpenLinkButton({ link, size = 'lg', block }: LinkButtonProps) {
  const { t } = useTranslation();
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className={styles.button} data-size={size} data-block={block || undefined}>
      <ExternalLink aria-hidden />
      {t('streams.open')}
    </a>
  );
}
