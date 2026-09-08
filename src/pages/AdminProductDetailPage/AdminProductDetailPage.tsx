import { App, Button, Tag } from 'antd';
import {
  BadgeDollarSign,
  Barcode,
  Boxes,
  CalendarClock,
  FileText,
  Fingerprint,
  Image as ImageIcon,
  Layers3,
  PackageSearch,
  Percent,
  ShieldCheck,
  Star,
  Store,
  Tags,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useAdminProductQuery,
  useReactivateAdminProductMutation,
  useSuspendAdminProductMutation,
} from '../../features/adminProducts/api/adminProductQueries';
import { getAdminProductModerationConfig } from '../../features/adminProducts/ui/adminProductModerationConfig';
import type { AdminProduct } from '../../features/adminProducts/model/adminProductTypes';
import { getAuthErrorMessage } from '../../features/auth/lib/getAuthErrorMessage';
import { formatDateTime } from '../../shared/lib/date';
import { useTranslation } from '../../shared/i18n/useTranslation';
import type { TranslationKey } from '../../shared/i18n/translations';
import { BackButton } from '../../shared/ui/BackButton/BackButton';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog/ConfirmDialog';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DetailPage, type DetailPageSection } from '../../shared/ui/DetailPage/DetailPage';
import { MoneyText } from '../../shared/ui/MoneyText/MoneyText';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import styles from './AdminProductDetailPage.module.css';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

function createSections(product: AdminProduct, locale: string, t: Translate): DetailPageSection[] {
  const attributeFields = Object.entries(product.attributes).map(([key, value]) => ({
    key: `attribute-${key}`,
    icon: <Tags />,
    label: key,
    value,
  }));
  return [
    {
      key: 'catalog',
      icon: <PackageSearch aria-hidden />,
      title: t('adminProducts.catalogInfo'),
      description: t('adminProducts.catalogInfoDescription'),
      fields: [
        { key: 'id', icon: <Fingerprint />, label: t('adminProducts.productId'), value: `#${product.id}` },
        { key: 'name', icon: <PackageSearch />, label: t('adminProducts.name'), value: product.name },
        { key: 'slug', icon: <Barcode />, label: t('adminProducts.slug'), value: product.slug || '—' },
        { key: 'category', icon: <Layers3 />, label: t('adminProducts.categoryId'), value: product.categoryId ? `#${product.categoryId}` : '—' },
        { key: 'description', icon: <FileText />, label: t('adminProducts.productDescription'), value: product.description || '—' },
        { key: 'variants', icon: <Boxes />, label: t('adminProducts.hasVariants'), value: product.hasVariants ? t('common.yes') : t('common.no') },
      ],
    },
    {
      key: 'ownership',
      icon: <Store aria-hidden />,
      title: t('adminProducts.ownership'),
      description: t('adminProducts.ownershipDescription'),
      fields: [
        { key: 'shop', icon: <Store />, label: t('adminProducts.shopId'), value: product.shopId ? `#${product.shopId}` : '—' },
        { key: 'owner', icon: <UserRound />, label: t('adminProducts.ownerId'), value: product.ownerUserId ? `#${product.ownerUserId}` : '—' },
      ],
    },
    {
      key: 'commercial',
      icon: <BadgeDollarSign aria-hidden />,
      title: t('adminProducts.commercialInfo'),
      description: t('adminProducts.commercialInfoDescription'),
      fields: [
        { key: 'price', icon: <BadgeDollarSign />, label: t('adminProducts.price'), value: <MoneyText value={product.price} /> },
        { key: 'oldPrice', icon: <Percent />, label: t('adminProducts.oldPrice'), value: product.oldPrice === null ? '—' : <MoneyText value={product.oldPrice} /> },
        { key: 'rating', icon: <Star />, label: t('adminProducts.rating'), value: product.rating > 0 ? product.rating.toFixed(2) : '—' },
      ],
    },
    {
      key: 'moderation',
      icon: <ShieldCheck aria-hidden />,
      title: t('adminProducts.moderation'),
      description: t('adminProducts.moderationDescription'),
      fields: [
        { key: 'status', icon: <ShieldCheck />, label: t('adminProducts.productStatus'), value: <StatusTag status={product.status} /> },
        { key: 'blocked', icon: <ShieldCheck />, label: t('adminProducts.moderationStatus'), value: <StatusTag status={product.isBlocked ? 'BLOCKED' : 'ACTIVE'} /> },
        { key: 'created', icon: <CalendarClock />, label: t('common.createdAt'), value: product.createdAt ? formatDateTime(product.createdAt, locale) : '—' },
        { key: 'updated', icon: <CalendarClock />, label: t('common.updatedAt'), value: product.updatedAt ? formatDateTime(product.updatedAt, locale) : '—' },
      ],
    },
    {
      key: 'attributes',
      icon: <Tags aria-hidden />,
      title: t('adminProducts.attributes'),
      description: t('adminProducts.attributesDescription'),
      fields: attributeFields.length ? attributeFields : [{ key: 'empty', icon: <Tags />, label: t('adminProducts.attributes'), value: t('adminProducts.noAttributes') }],
    },
  ];
}

export default function AdminProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const { message } = App.useApp();
  const { locale, t } = useTranslation();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const query = useAdminProductQuery(productId ?? '');
  const suspendMutation = useSuspendAdminProductMutation();
  const reactivateMutation = useReactivateAdminProductMutation();
  const product = query.data;

  if (!productId || query.isPending || query.isError || !product) {
    return (
      <main className={styles.statePage}>
        <PageHeader
          before={<BackButton fallback="/admin/products" />}
          title={t('adminProducts.detailTitle')}
          description={productId ? t('adminProducts.productNumber', { id: productId }) : t('adminProducts.notIdentified')}
        />
        {!productId ? (
          <ContentState state="error" title={t('adminProducts.notIdentified')} description={t('adminProducts.notIdentifiedDescription')} />
        ) : query.isError ? (
          <ContentState state="error" title={t('adminProducts.detailLoadError')} description={getAuthErrorMessage(query.error)} onAction={() => void query.refetch()} />
        ) : (
          <ContentState state="loading" />
        )}
      </main>
    );
  }

  const actionConfig = getAdminProductModerationConfig(product.isBlocked);
  const mutation = actionConfig.action === 'reactivate' ? reactivateMutation : suspendMutation;
  const images = Array.from(new Set([product.imageUrl, ...product.images].filter((value): value is string => Boolean(value))));

  return (
    <>
      <DetailPage
        backFallback="/admin/products"
        title={t('adminProducts.detailTitle')}
        description={t('adminProducts.productNumber', { id: product.id })}
        actions={
          <Button
            danger={actionConfig.danger}
            icon={<actionConfig.Icon size={17} />}
            loading={mutation.isPending}
            onClick={() => setConfirmationOpen(true)}
          >
            {t(actionConfig.labelKey)}
          </Button>
        }
        hero={{
          avatarUrl: product.imageUrl,
          avatarShape: 'square',
          avatarFallback: product.name.slice(0, 2).toUpperCase(),
          title: product.name,
          subtitle: product.slug || `#${product.id}`,
          badges: <><StatusTag status={product.status} />{product.isBlocked ? <StatusTag status="BLOCKED" /> : null}</>,
        }}
        sections={createSections(product, locale, t)}
      >
        <section className={styles.mediaCard}>
          <header>
            <ImageIcon aria-hidden />
            <div><h3>{t('adminProducts.images')}</h3><p>{t('adminProducts.imagesDescription')}</p></div>
          </header>
          {images.length ? (
            <div className={styles.gallery}>
              {images.map((image, index) => <img key={image} src={image} alt={t('adminProducts.imageAlt', { index: index + 1, name: product.name })} loading="lazy" />)}
            </div>
          ) : (
            <div className={styles.noMedia}><ImageIcon aria-hidden /><span>{t('adminProducts.noImages')}</span></div>
          )}
        </section>
        {product.variants.length ? (
          <section className={styles.mediaCard}>
            <header><Boxes aria-hidden /><div><h3>{t('adminProducts.variants')}</h3><p>{t('adminProducts.variantsDescription')}</p></div></header>
            <div className={styles.variants}>
              {product.variants.map((variant) => (
                <article key={variant.id || variant.sku}>
                  <div><strong>{variant.name || variant.sku}</strong><code>{variant.sku}</code></div>
                  <span>{variant.price === null ? <MoneyText value={product.price} /> : <MoneyText value={variant.price} />}</span>
                  <Tag color={variant.isActive ? 'success' : 'default'}>{variant.isActive ? t('status.active') : t('status.inactive')}</Tag>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </DetailPage>
      <ConfirmDialog
        open={confirmationOpen}
        title={t(actionConfig.titleKey)}
        description={t(actionConfig.descriptionKey, { name: product.name })}
        confirmText={t(actionConfig.labelKey)}
        danger={actionConfig.danger}
        loading={mutation.isPending}
        onCancel={() => setConfirmationOpen(false)}
        onConfirm={() => mutation.mutate(product.id, {
          onSuccess: () => {
            setConfirmationOpen(false);
            void message.success(t(actionConfig.successKey));
          },
          onError: (error) => void message.error(getAuthErrorMessage(error)),
        })}
      />
    </>
  );
}
