import axios from 'axios';
import {
  BadgeCheck,
  Image as ImageIcon,
  PackageOpen,
  Search,
  Share2,
  ShoppingBag,
  Star,
  Store,
} from 'lucide-react';
import { App, Button, Input, InputNumber, Pagination, Select, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useStorefrontShopQuery } from '../../features/storefront/api/storefrontQueries';
import type { StorefrontSort } from '../../features/storefront/model/storefrontTypes';
import { usePublicCategoriesQuery } from '../../features/categories/api/categoryQueries';
import { createCategoryOptions } from '../../features/categories/lib/categoryOptions';
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { MoneyText } from '../../shared/ui/MoneyText/MoneyText';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { LanguageSwitcher } from '../../shared/ui/LanguageSwitcher/LanguageSwitcher';
import styles from './StorefrontShopPage.module.css';

const PAGE_SIZE = 12;

function readPositiveNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!node) {
    node = document.createElement('meta');
    node.setAttribute(attribute, key);
    document.head.append(node);
  }
  node.content = content;
}

export default function StorefrontShopPage() {
  const { message } = App.useApp();
  const { shopSlug = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim());
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const categoryId = searchParams.get('categoryId') ?? '';
  const sort = (searchParams.get('sort') ?? 'createdAt:desc') as StorefrontSort;
  const minPrice = readPositiveNumber(searchParams.get('minPrice'));
  const maxPrice = readPositiveNumber(searchParams.get('maxPrice'));
  const [priceDraft, setPriceDraft] = useState<[number | null, number | null]>([
    minPrice ?? null,
    maxPrice ?? null,
  ]);
  const categoriesQuery = usePublicCategoriesQuery();
  const shopQuery = useStorefrontShopQuery(shopSlug, {
    page,
    limit: PAGE_SIZE,
    sort,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
  });
  const categoryOptions = useMemo(() => [
    { value: '', label: t('storefront.category') },
    ...createCategoryOptions(categoriesQuery.data ?? []).filter((item) => !item.disabled),
  ], [categoriesQuery.data, t]);

  const updateParams = (updates: Record<string, string | number | undefined>, resetPage = true) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      if (resetPage) next.delete('page');
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    const current = searchParams.get('search') ?? '';
    if (debouncedSearch === current) return;
    updateParams({ search: debouncedSearch || undefined });
  // URL yozuvi aynan debounced qiymat o‘zgarganda bajariladi.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const shop = shopQuery.data?.shop;
  useEffect(() => {
    if (!shop) return;
    const description = shop.description || t('storefront.noDescription');
    const canonical = `${window.location.origin}/dokon/${encodeURIComponent(shop.slug)}`;
    const image = shop.logoUrl || `${window.location.origin}/og-markethub.jpg`;
    document.title = `${shop.name} — MarketHub`;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', 'index, follow, max-image-preview:large');
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:title', shop.name);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', image);
    setMeta('name', 'twitter:title', shop.name);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.append(link);
    }
    link.href = canonical;
  }, [shop, t]);

  const shareShop = async () => {
    const url = `${window.location.origin}/dokon/${encodeURIComponent(shop?.slug ?? shopSlug)}`;
    if (navigator.share) {
      await navigator.share({ title: shop?.name, text: shop?.description ?? undefined, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    void message.success(t('storefront.shared'));
  };

  const notFound = axios.isAxiosError(shopQuery.error) && shopQuery.error.response?.status === 404;
  if (shopQuery.isPending) {
    return <main className={styles.statePage}><ContentState state="loading" /></main>;
  }
  if (shopQuery.isError || !shop || shop.status !== 'ACTIVE') {
    return (
      <main className={styles.statePage}>
        <Link className={styles.stateBrand} to="/login"><Store /> MarketHub</Link>
        <ContentState
          state={notFound || shop?.status !== 'ACTIVE' ? 'empty' : 'error'}
          title={notFound || shop?.status !== 'ACTIVE' ? t('storefront.unavailable') : t('storefront.loadError')}
          description={notFound || shop?.status !== 'ACTIVE' ? t('storefront.unavailableDescription') : t('storefront.loadErrorDescription')}
          {...(!notFound && (!shop || shop.status === 'ACTIVE') ? { onAction: () => void shopQuery.refetch() } : {})}
        />
      </main>
    );
  }

  const products = shopQuery.data.products.items;
  const hasFilters = Boolean(debouncedSearch || categoryId || minPrice !== undefined || maxPrice !== undefined || sort !== 'createdAt:desc');

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link className={styles.brand} to={`/dokon/${encodeURIComponent(shop.slug)}`}>
          <span className={styles.brandMark}><ShoppingBag /></span>
          <span>{t('storefront.brand')}</span>
        </Link>
        <nav className={styles.topActions} aria-label="Do‘kon navigatsiyasi">
          <LanguageSwitcher compact />
          <Link className={styles.loginLink} to="/login">{t('storefront.login')}</Link>
        </nav>
      </header>

      <main className={styles.content}>
        <section className={styles.hero} aria-labelledby="shop-title">
          <div className={styles.bannerFallback} />
          {shop.bannerUrl ? <img className={styles.banner} src={shop.bannerUrl} alt="" onError={(event) => event.currentTarget.remove()} /> : null}
          <div className={styles.heroShade} />
          <div className={styles.shopIdentity}>
            <div className={styles.logoWrap}>
              <span className={styles.logoFallback} aria-label={`${shop.name} logotipi`}>{initials(shop.name)}</span>
              {shop.logoUrl ? <img className={styles.logo} src={shop.logoUrl} alt="" onError={(event) => event.currentTarget.remove()} /> : null}
            </div>
            <div className={styles.shopCopy}>
              <span className={styles.verified}><BadgeCheck /> {t('storefront.verified')}</span>
              <Typography.Title id="shop-title" level={1}>{shop.name}</Typography.Title>
              <Typography.Paragraph>{shop.description || t('storefront.noDescription')}</Typography.Paragraph>
              <div className={styles.metrics}>
                <span><Star fill="currentColor" /> <strong>{shop.rating.toFixed(1)}</strong> {t('storefront.rating')}</span>
                <span><PackageOpen /> <strong>{shopQuery.data.products.total}</strong> {t('storefront.products')}</span>
                {shop.ordersCount > 0 ? <span><ShoppingBag /> <strong>{shop.ordersCount}</strong> {t('storefront.orders')}</span> : null}
              </div>
            </div>
            <Button className={styles.shareButton} icon={<Share2 />} onClick={() => void shareShop()}>{t('storefront.share')}</Button>
          </div>
        </section>

        <section className={styles.catalog} aria-labelledby="catalog-title">
          <div className={styles.catalogHeading}>
            <div>
              <Typography.Title id="catalog-title" level={2}>{t('storefront.products')}</Typography.Title>
              <Typography.Text>{t('storefront.results', { count: shopQuery.data.products.total })}</Typography.Text>
            </div>
            {hasFilters ? <Button type="text" onClick={() => { setSearch(''); setPriceDraft([null, null]); setSearchParams({}, { replace: true }); }}>{t('storefront.clear')}</Button> : null}
          </div>

          <div className={styles.filters} aria-label="Mahsulot filtrlari">
            <Input
              className={styles.search}
              prefix={<Search />}
              value={search}
              allowClear
              aria-label={t('storefront.search')}
              placeholder={t('storefront.search')}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select className={styles.select} value={categoryId} options={categoryOptions} loading={categoriesQuery.isPending} aria-label={t('storefront.category')} onChange={(value) => updateParams({ categoryId: value || undefined })} />
            <Select<StorefrontSort>
              className={styles.select}
              value={sort}
              aria-label={t('storefront.sort')}
              onChange={(value) => updateParams({ sort: value === 'createdAt:desc' ? undefined : value })}
              options={[
                { value: 'createdAt:desc', label: t('storefront.newest') },
                { value: 'createdAt:asc', label: t('storefront.oldest') },
                { value: 'price:asc', label: t('storefront.priceLow') },
                { value: 'price:desc', label: t('storefront.priceHigh') },
                { value: 'name:asc', label: t('storefront.nameAsc') },
                { value: 'name:desc', label: t('storefront.nameDesc') },
              ]}
            />
            <div className={styles.priceFilter}>
              <InputNumber min={0} value={priceDraft[0]} placeholder={t('storefront.minPrice')} aria-label={t('storefront.minPrice')} onChange={(value) => setPriceDraft((current) => [value, current[1]])} />
              <span>—</span>
              <InputNumber min={0} value={priceDraft[1]} placeholder={t('storefront.maxPrice')} aria-label={t('storefront.maxPrice')} onChange={(value) => setPriceDraft(([min]) => [min, value])} />
              <Button onClick={() => updateParams({ minPrice: priceDraft[0] ?? undefined, maxPrice: priceDraft[1] ?? undefined })}>{t('storefront.applyPrice')}</Button>
            </div>
          </div>

          {products.length ? (
            <div className={styles.productGrid}>
              {products.map((product) => (
                <Link className={styles.productLink} to={`/mahsulot/${encodeURIComponent(product.id)}`} key={product.id}>
                <article className={styles.productCard}>
                  <div className={styles.productMedia}>
                    <span><ImageIcon /><small>{t('storefront.noImage')}</small></span>
                    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" onError={(event) => event.currentTarget.remove()} /> : null}
                    {product.oldPrice && product.oldPrice > product.price
                      ? <span className={styles.discount}>−{Math.round((1 - product.price / product.oldPrice) * 100)}%</span>
                      : null}
                  </div>
                  <div className={styles.productBody}>
                    {product.category ? <small>{product.category}</small> : null}
                    <Typography.Title level={3}>{product.name}</Typography.Title>
                    <div className={styles.productRating}><Star fill="currentColor" /> {product.rating > 0 ? product.rating.toFixed(1) : '—'}</div>
                    <div className={styles.price}>
                      <MoneyText value={product.price} strong />
                      {product.oldPrice && product.oldPrice > product.price ? <del><MoneyText value={product.oldPrice} /></del> : null}
                    </div>
                  </div>
                </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}><ContentState state="empty" title={t('storefront.empty')} description={t('storefront.emptyDescription')} /></div>
          )}

          {shopQuery.data.products.total > PAGE_SIZE ? (
            <Pagination current={page} pageSize={PAGE_SIZE} total={shopQuery.data.products.total} showSizeChanger={false} onChange={(next) => updateParams({ page: next }, false)} />
          ) : null}
        </section>
      </main>
    </div>
  );
}
