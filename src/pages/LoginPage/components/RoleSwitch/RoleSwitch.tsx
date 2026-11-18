import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import styles from '../../../../shared/ui/AuthLayout/authForm.module.css';

export type LoginMode = 'seller' | 'staff';

const MODES: readonly LoginMode[] = ['seller', 'staff'];

interface RoleSwitchProps {
  value: LoginMode;
  onChange: (mode: LoginMode) => void;
  /**
   * Tanlov almashganda forma butunlay boshqasiga almashadi va tanlov qayta chiziladi —
   * fokus yo'qolmasin: foydalanuvchi almashtirgan bo'lsa, tanlangan band fokus oladi.
   */
  keepFocus?: boolean;
}

/**
 * «Kim sifatida kirasiz» (umumiy-kirish): radio guruh — strelkalar bilan almashadi,
 * Tab faqat tanlangan bandga tushadi.
 */
export function RoleSwitch({ value, onChange, keepFocus = false }: RoleSwitchProps) {
  const { t } = useTranslation();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (keepFocus) refs.current[MODES.indexOf(value)]?.focus();
  }, [keepFocus, value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + MODES.length) % MODES.length;
    onChange(MODES[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={t('sellerLogin.who')} className={styles.segmented}>
      {MODES.map((mode, index) => (
        <button
          key={mode}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === mode}
          tabIndex={value === mode ? 0 : -1}
          className={styles.segment}
          onClick={() => onChange(mode)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {mode === 'seller' ? t('sellerLogin.seller') : t('sellerLogin.staff')}
        </button>
      ))}
    </div>
  );
}
