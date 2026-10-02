import { Select } from 'antd';
import { useState } from 'react';
import { useDebouncedValue } from '../../../shared/lib/useDebouncedValue';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useAdminShopsQuery } from '../api/adminShopQueries';

export interface ShopReference {
  slug: string;
  name: string;
}

interface AdminShopSelectProps {
  id?: string;
  value?: ShopReference | null;
  onChange?: (shop: ShopReference) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Faol do'konni nomi bo'yicha qidirib tanlash (server qidiruvi). Forma
 * maydoni sifatida ishlaydi: qiymati `{ slug, name }` — slug storefront
 * havolasi (`/dokon/:slug`) uchun, nom esa ko'rsatish uchun.
 */
export function AdminShopSelect({ id, value, onChange, disabled, placeholder }: AdminShopSelectProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const query = useAdminShopsQuery({ page: 1, limit: 20, status: 'ACTIVE', ...(debouncedSearch ? { search: debouncedSearch } : {}) });
  // Slug'siz do'konga storefront havolasi tuzib bo'lmaydi.
  const shops: ShopReference[] = query.data?.items.filter(({ slug }) => slug).map(({ slug, name }) => ({ slug, name })) ?? [];
  // Tanlangan do'kon joriy qidiruv natijasida bo'lmasa ham nomi ko'rinib tursin.
  if (value && !shops.some(({ slug }) => slug === value.slug)) shops.unshift(value);

  return (
    <Select<string>
      id={id}
      value={value?.slug}
      options={shops.map(({ slug, name }) => ({ value: slug, label: name }))}
      showSearch={{ onSearch: setSearch, filterOption: false }}
      loading={query.isFetching}
      disabled={disabled}
      placeholder={placeholder}
      notFoundContent={query.isFetching ? null : t('adminShops.empty')}
      onChange={(slug) => {
        const shop = shops.find((item) => item.slug === slug);
        if (shop) onChange?.(shop);
        setSearch('');
      }}
    />
  );
}
