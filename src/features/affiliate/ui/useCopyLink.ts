import { App } from 'antd';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { splitStreamLink } from '../lib/streamLink';

/**
 * Havolani nusxalash: bufer + toast «Havola nusxalandi» (komponentlar-E §11): desktopda o'ng
 * pastda, telefonda yuqorida, 4 soniya.
 */
export function useCopyLink() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  return (link: string) =>
    navigator.clipboard.writeText(link).then(
      () => {
        const { domain, code } = splitStreamLink(link);
        notification.success({
          title: t('streams.copied'),
          description: t('streams.copiedText', { link: domain ? `${domain}/${code}` : code }),
          placement: phone ? 'top' : 'bottomRight',
          duration: 4,
        });
      },
      () => notification.error({ title: t('copy.failed'), placement: phone ? 'top' : 'bottomRight' }),
    );
}
