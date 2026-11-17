import { App, Button } from 'antd';
import { Copy, LogOut, RefreshCw, UserX } from 'lucide-react';
import { BRAND } from '../../shared/config/brand';
import type { UnknownRoleError } from '../../features/auth/lib/unknownRoleError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatDateTime } from '../../shared/lib/date';
import { StatusPanel, StatusPanelChip } from '../../shared/ui/StatusPanel/StatusPanel';
import { BrandRow } from './NavMenu';
import { TopBar, UserMenu } from './TopBar';
import { useShellLayout } from './useShellLayout';
import styles from './AppShell.module.css';

interface UnknownRoleShellProps {
  error: UnknownRoleError;
  /** Rol tanilmagan javob kelgan vaqt — «Kirgan vaqti». */
  checkedAt: number;
  onRecheck: () => void;
  onLogout: () => void;
}

/**
 * Backend tanilmagan rol qaytardi (FE-01 TC3, umumiy-403 §2): oq ekran emas —
 * menyusiz karkas, sabab va chiqish yo'li. Qo'ng'iroqcha yo'q; telefonda
 * «Chiqish» va «Qayta tekshirish» pastki panelda.
 */
export function UnknownRoleShell({ error, checkedAt, onRecheck, onLogout }: UnknownRoleShellProps) {
  const { message } = App.useApp();
  const { locale, t } = useTranslation();
  const layout = useShellLayout();
  const phone = layout === 'phone';
  const name = error.userName ?? t('unknownRole.user');
  const id = error.userId ?? '—';
  const signedInAt = formatDateTime(new Date(checkedAt).toISOString(), locale);

  const copy = () => {
    const text = [
      `${t('unknownRole.user')}: ${name}`,
      `${t('unknownRole.id')}: ${id}`,
      `${t('unknownRole.role')}: ${error.role || '—'}`,
      `${t('unknownRole.signedInAt')}: ${signedInAt}`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(
      () => void message.success(t('unknownRole.copied')),
      () => void message.error(t('unknownRole.copyFailed')),
    );
  };

  const recheck = (
    <Button type="primary" size={phone ? 'large' : undefined} icon={<RefreshCw size={18} aria-hidden />} onClick={onRecheck}>
      {t('unknownRole.recheck')}
    </Button>
  );
  const logout = (
    <Button size={phone ? 'large' : undefined} icon={<LogOut size={18} aria-hidden />} onClick={onLogout}>
      {t('unknownRole.logout')}
    </Button>
  );

  return (
    <div className={`${styles.shell} ${styles[layout]}`} data-testid="app-layout" data-shell="unknown" data-layout={layout}>
      {layout === 'desktop' ? (
        <nav className={styles.nav} aria-label={t('shell.mainMenu')}>
          <BrandRow />
          <p className={styles.noMenu}>{t('unknownRole.noMenu')}</p>
        </nav>
      ) : null}
      <div className={styles.column}>
        <TopBar
          layout={layout}
          title={t('unknownRole.pageTitle')}
          leading={layout === 'desktop' ? undefined : (
            <span className={styles.leadingBrand}>
              <img className={styles.brandIcon} src="/brand/elchi-app-icon.png" alt={BRAND.name} width={32} height={32} />
            </span>
          )}
          user={
            <UserMenu name={name} roleLabel={t('unknownRole.roleUnknown')} touch={layout !== 'desktop'} onLogout={onLogout} />
          }
        />
        <main className={styles.main} data-app-main>
          <StatusPanel
            testId="unknown-role"
            icon={<UserX />}
            code={t('unknownRole.title')}
            heading={t('unknownRole.heading')}
            text={t('unknownRole.text')}
            actions={phone ? undefined : <>{recheck}{logout}</>}
            aside={{
              title: t('unknownRole.sendToAdmin'),
              rows: [
                { label: t('unknownRole.user'), value: name },
                { label: t('unknownRole.id'), value: <StatusPanelChip>{id}</StatusPanelChip> },
                { label: t('unknownRole.signedInAt'), value: signedInAt },
              ],
              footer: (
                <Button className={styles.copyButton} icon={<Copy size={18} aria-hidden />} onClick={copy}>
                  {t('unknownRole.copy')}
                </Button>
              ),
            }}
          />
        </main>
        {phone ? <div className={styles.bottomBar}>{logout}{recheck}</div> : null}
      </div>
    </div>
  );
}
