import { Button, Dropdown } from 'antd';
import { ChevronDown, Languages } from 'lucide-react';
import { useAppDispatch } from '../../../app/store/hooks';
import { languageChanged, type Language } from '../../../features/preferences/model/preferencesSlice';
import { useTranslation } from '../../i18n/useTranslation';

const languageOptions: Array<{ key: Language; label: string }> = [
  { key: 'uz', label: "O‘zbekcha" },
  { key: 'ru', label: 'Русский' },
  { key: 'en', label: 'English' },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const dispatch = useAppDispatch();
  const { language, t } = useTranslation();
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        selectable: true,
        selectedKeys: [language],
        items: languageOptions,
        onClick: ({ key }) => dispatch(languageChanged(key as Language)),
      }}
    >
      <Button type="text" aria-label={t('header.selectLanguage')}>
        <Languages size={18} aria-hidden />
        {!compact ? <span>{language.toUpperCase()}</span> : null}
        <ChevronDown size={14} aria-hidden />
      </Button>
    </Dropdown>
  );
}
