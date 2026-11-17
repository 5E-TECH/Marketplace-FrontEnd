import { Dropdown, type MenuProps } from 'antd';
import { Check, ChevronDown, ChevronLeft, Languages, LogOut, Menu, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../app/store/hooks';
import { languageChanged, type Language } from '../../features/preferences/model/preferencesSlice';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { initials } from '../../shared/lib/initials';
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher/LanguageSwitcher';
import { LANGUAGE_OPTIONS } from '../../shared/ui/LanguageSwitcher/languageOptions';
import styles from './AppShell.module.css';

export type ShellLayout = 'desktop' | 'tablet' | 'phone' | 'rail';

interface UserMenuProps {
  name: string;
  roleLabel: string;
  /** Planshet va telefon: faqat avatar (44 px), bandlar 44 px. */
  touch: boolean;
  /** Berilmasa «Profil» bandi chiqmaydi (noma'lum rol). */
  profilePath?: string;
  onLogout: () => void;
}

/** Foydalanuvchi tugmasi va menyusi (karkas-E 1.6, 1.10). «Yordam» — bosqich «?», M1 da yo'q. */
export function UserMenu({ name, roleLabel, touch, profilePath, onLogout }: UserMenuProps) {
  const { language, t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const languageName = LANGUAGE_OPTIONS.find(({ key }) => key === language)?.label;

  const items: MenuProps['items'] = [
    ...(profilePath ? [{ key: 'profile', icon: <UserRound aria-hidden />, label: t('shell.profile') }] : []),
    {
      key: 'language',
      icon: <Languages aria-hidden />,
      label: <span className={styles.userMenuValue}>{t('shell.language')}<span>{languageName}</span></span>,
      children: LANGUAGE_OPTIONS.map(({ key, label }) => ({
        key: `language:${key}`,
        label: <span className={styles.userMenuValue}>{label}{key === language ? <Check aria-hidden /> : null}</span>,
      })),
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogOut aria-hidden />, label: t('shell.logout'), danger: true },
  ];

  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile' && profilePath) void navigate(profilePath);
    else if (key === 'logout') onLogout();
    else if (key.startsWith('language:')) dispatch(languageChanged(key.slice(9) as Language));
    setOpen(false);
  };

  const avatar = <span className={styles.avatar} aria-hidden>{initials(name)}</span>;

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      menu={{
        items,
        onClick,
        'aria-label': t('shell.userMenu'),
      }}
      popupRender={(menu) => (
        <div className={touch ? styles.touch : undefined}>
          <div className={styles.userMenu}>
            <div className={styles.userMenuHead}>
              {avatar}
              <span className={styles.userText}>
                <span className={styles.userMenuName}>{name}</span>
                <span className={styles.userRole}>{roleLabel}</span>
              </span>
            </div>
            {menu}
          </div>
        </div>
      )}
    >
      <button
        type="button"
        className={touch ? styles.iconButton : styles.userButton}
        aria-haspopup="menu"
        aria-expanded={open}
        title={touch ? undefined : t('shell.userButtonTitle')}
        aria-label={touch ? t('shell.userButtonAria', { name, role: roleLabel }) : undefined}
        data-testid="user-menu-button"
      >
        {avatar}
        {touch ? null : (
          <>
            <span className={styles.userText}>
              <span className={styles.userName}>{name}</span>
              <span className={styles.userRole}>{roleLabel}</span>
            </span>
            <ChevronDown className={styles.chevron} aria-hidden />
          </>
        )}
      </button>
    </Dropdown>
  );
}

interface TopBarProps {
  layout: ShellLayout;
  title: string;
  /** Ichki sahifa: «‹ Bo'lim» (desktop, planshet) yoki telefonda menyu o'rnidagi orqaga tugmasi. */
  back?: { path: string; label: string };
  /** Chap panelni ochish (planshet, telefon). Berilmasa menyu tugmasi yo'q. */
  onMenuOpen?: () => void;
  /** Menyu tugmasi o'rnida (noma'lum rol, telefon): brend belgisi. */
  leading?: ReactNode;
  bell?: ReactNode;
  user: ReactNode;
  /** Rol elementlari `h1` dan keyin (operator: «Holat»). Telefonda chiqmaydi. */
  afterTitle?: ReactNode;
  /** Rol elementlari o'ngda, til va qo'ng'iroqchadan oldin (operator: bronlar, soat). */
  beforeTools?: ReactNode;
}

/**
 * Yuqori qator (karkas-E 1.6, 4.2, 5.2). Desktop: chapda `h1`, o'ngda til va
 * qo'ng'iroqcha | foydalanuvchi. Planshet va telefon: menyu, `h1`, qo'ng'iroqcha, avatar;
 * til — chap panel pastida va foydalanuvchi menyusida.
 */
export function TopBar({ layout, title, back, onMenuOpen, leading, bell, user, afterTitle, beforeTools }: TopBarProps) {
  const { t } = useTranslation();
  const touch = layout !== 'desktop';
  const phoneBack = layout === 'phone' && back;

  return (
    <header className={styles.topBar}>
      <div className={styles.topBarStart}>
        {phoneBack ? (
          <Link to={back.path} className={styles.iconButton} aria-label={t('shell.back', { name: back.label })}>
            <ChevronLeft aria-hidden />
          </Link>
        ) : onMenuOpen ? (
          <button
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}`}
            aria-label={t('shell.openMenu')}
            aria-haspopup="dialog"
            onClick={onMenuOpen}
          >
            <Menu aria-hidden />
          </button>
        ) : leading}
        {back && !phoneBack ? (
          <Link to={back.path} className={styles.backLink} aria-label={t('shell.back', { name: back.label })}>
            <ChevronLeft size={18} aria-hidden />
            {back.label}
          </Link>
        ) : null}
        <h1 className={styles.title}>{title}</h1>
        {layout === 'phone' ? null : afterTitle}
      </div>
      <div className={styles.topBarEnd}>
        {touch ? (
          <>
            {layout === 'phone' ? null : beforeTools}
            {bell}
            {user}
          </>
        ) : (
          <>
            {beforeTools}
            {beforeTools ? <span className={styles.divider} aria-hidden /> : null}
            <div className={styles.topBarTools}>
              <LanguageSwitcher />
              {bell}
            </div>
            <span className={styles.divider} aria-hidden />
            {user}
          </>
        )}
      </div>
    </header>
  );
}
