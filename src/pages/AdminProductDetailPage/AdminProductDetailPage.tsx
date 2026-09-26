import { App, Button, Form, Image, Input, Modal, Tag } from 'antd';
import {
  BadgeDollarSign,
  Boxes,
  CalendarClock,
  FileText,
  Image as ImageIcon,
  Layers3,
  PackageSearch,
  Percent,
  Star,
  Store,
  Tags,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useAdminProductQuery,
  useSetAdminProductHiddenMutation,
} from '../../features/adminProducts/api/adminProductQueries';
import { getAdminProductModerationConfig } from '../../features/adminProducts/ui/adminProductModerationConfig';
import type { AdminProduct } from '../../features/adminProducts/model/adminProductTypes';
import { useAdminShopNames } from '../../features/adminShops/api/adminShopQueries';
import { useAdminCategoryNames } from '../../features/categories/api/categoryQueries';
import { getProductCover } from '../../features/products/lib/getProductCover';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { formatDateTime } from '../../shared/lib/date';
import { useTranslation } from '../../shared/i18n/useTranslation';
import type { TranslationKey } from '../../shared/i18n/translations';
import { BackButton } from '../../shared/ui/BackButton/BackButton';
import { ContentState } from '../../shared/ui/ContentState/ContentState';
import { DetailPage, type DetailPageSection } from '../../shared/ui/DetailPage/DetailPage';
import { MoneyText } from '../../shared/ui/MoneyText/MoneyText';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag/StatusTag';
import styles from './AdminProductDetailPage.module.css';

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * Nom, slug, ID va holat hero'da turadi — bu yerda takrorlanmaydi.
 * Kategoriya va do'kon ID o'rniga nomi bilan (topilmasa `#ID`).
 */
function createSections(product: AdminProduct, locale: string, t: Translate, names: { shop?: string; category?: string }): DetailPageSection[] {
  const attributeFields = Object.entries(product.attributes).map(([key, value]) => ({
    key: `attribute-${key}`,
    icon: <Tags />,
    label: key,
    value,
  }));
  return [
    {
      key: 'overview',
      icon: <PackageSearch aria-hidden />,
      title: t('adminProducts.overview'),
      description: t('adminProducts.overviewDescription'),
      fields: [
        { key: 'category', icon: <Layers3 />, label: t('adminProducts.category'), value: product.categoryId ? names.category ?? `#${product.categoryId}` : '—' },
        { key: 'shop', icon: <Store />, label: t('adminProducts.shop'), value: product.shopId ? names.shop ?? `#${product.shopId}` : '—' },
        { key: 'owner', icon: <UserRound />, label: t('adminProducts.ownerId'), value: product.ownerUserId ? `#${product.ownerUserId}` : '—' },
        { key: 'price', icon: <BadgeDollarSign />, label: t('adminProducts.price'), value: <MoneyText value={product.price} /> },
        { key: 'oldPrice', icon: <Percent />, label: t('adminProducts.oldPrice'), value: product.oldPrice === null ? '—' : <MoneyText value={product.oldPrice} /> },
        { key: 'rating', icon: <Star />, label: t('adminProducts.rating'), value: product.rating > 0 ? product.rating.toFixed(2) : '—' },
        { key: 'variants', icon: <Boxes />, label: t('adminProducts.hasVariants'), value: product.hasVariants ? t('common.yes') : t('common.no') },
        { key: 'created', icon: <CalendarClock />, label: t('common.createdAt'), value: product.createdAt ? formatDateTime(product.createdAt, locale) : '—' },
        { key: 'updated', icon: <CalendarClock />, label: t('common.updatedAt'), value: product.updatedAt ? formatDateTime(product.updatedAt, locale) : '—' },
        { key: 'description', icon: <FileText />, label: t('adminProducts.productDescription'), value: product.description || '—', wide: true },
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
  const mutation = useSetAdminProductHiddenMutation();
  const [moderationForm] = Form.useForm<{ reason: string }>();
  const product = query.data;
  const shopNames = useAdminShopNames(product?.shopId ? [product.shopId] : []);
  const categoryNames = useAdminCategoryNames();

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
          <ContentState state="error" title={t('adminProducts.detailLoadError')} description={getApiErrorMessage(query.error)} onAction={() => void query.refetch()} />
        ) : (
          <ContentState state="loading" />
        )}
      </main>
    );
  }

  const actionConfig = getAdminProductModerationConfig(product.isBlocked);
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
          avatarUrl: getProductCover(product),
          avatarShape: 'square',
          avatarFallback: product.name.slice(0, 2).toUpperCase(),
          title: product.name,
          subtitle: product.slug || `#${product.id}`,
          badges: <><StatusTag status={product.status} />{product.isBlocked ? <StatusTag status="BLOCKED" /> : null}</>,
        }}
        sections={createSections(product, locale, t, { shop: shopNames.get(product.shopId), category: categoryNames.get(product.categoryId) })}
      >
        <section className={styles.mediaCard}>
          <header>
            <ImageIcon aria-hidden />
            <div><h3>{t('adminProducts.images')}</h3><p>{t('adminProducts.imagesDescription')}</p></div>
          </header>
          {images.length ? (
            <Image.PreviewGroup>
              <div className={styles.gallery}>
                {images.map((image, index) => <Image key={image} src={image} alt={t('adminProducts.imageAlt', { index: index + 1, name: product.name })} loading="lazy" />)}
              </div>
            </Image.PreviewGroup>
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
      <Modal
        open={confirmationOpen}
        title={t(actionConfig.titleKey)}
        okText={t(actionConfig.labelKey)}
        okButtonProps={{ danger: actionConfig.danger, loading: mutation.isPending }}
        onCancel={() => { setConfirmationOpen(false); moderationForm.resetFields(); }}
        onOk={() => moderationForm.submit()}
      >
        <p>{t(actionConfig.descriptionKey, { name: product.name })}</p>
        <Form form={moderationForm} layout="vertical" onFinish={({ reason }) => mutation.mutate({ productId: product.id, hidden: !product.isBlocked, ...(reason?.trim() ? { reason: reason.trim() } : {}) }, {
          onSuccess: () => {
            setConfirmationOpen(false);
            moderationForm.resetFields();
            void message.success(t(actionConfig.successKey));
          },
          onError: (error) => void message.error(getApiErrorMessage(error)),
        })}>
          {!product.isBlocked ? <Form.Item name="reason" label="Yashirish sababi" rules={[{ required: true, whitespace: true, message: 'Sotuvchiga yuboriladigan sababni kiriting' }, { min: 5 }, { max: 500 }]}><Input.TextArea rows={4} maxLength={500} showCount /></Form.Item> : null}
        </Form>
      </Modal>
    </>
  );
}
