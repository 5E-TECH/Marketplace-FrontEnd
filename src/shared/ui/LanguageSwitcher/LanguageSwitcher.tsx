import { Dropdown } from 'antd';
import { ChevronDown } from 'lucide-react';
import { useAppDispatch } from '../../../app/store/hooks';
import { languageChanged, type Language } from '../../../features/preferences/model/preferencesSlice';
import { useTranslation } from '../../i18n/useTranslation';
import { LANGUAGE_OPTIONS } from './languageOptions';
import styles from './LanguageSwitcher.module.css';

interface LanguageSwitcherProps {
  /** `short` — «UZ ⌄» (yuqori qator, login); `full` — «O‘zbekcha ⌄» (navy panel). */
  variant?: 'short' | 'full';
  /** Eski chaqiruvlar uchun: `compact` = `short`. */
  compact?: boolean;
  className?: string;
}

/** Til tugmasi (karkas-E 1.6, 4.3): 40 px, ochilganda tillar menyusi. */
export function LanguageSwitcher({ variant = 'short', className }: LanguageSwitcherProps) {
  const dispatch = useAppDispatch();
  const { language, t } = useTranslation();
  const current = LANGUAGE_OPTIONS.find(({ key }) => key === language) ?? LANGUAGE_OPTIONS[0];
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        selectable: true,
        selectedKeys: [language],
        items: LANGUAGE_OPTIONS.map(({ key, label }) => ({ key, label })),
        onClick: ({ key }) => dispatch(languageChanged(key as Language)),
      }}
    >
      <button
        type="button"
        className={`${variant === 'full' ? styles.full : styles.short} ${className ?? ''}`.trim()}
        aria-label={t('shell.languageAria', { name: current.label.toLocaleLowerCase() })}
      >
        {variant === 'full' ? current.label : language.toUpperCase()}
        <ChevronDown aria-hidden />
      </button>
    </Dropdown>
  );
}
