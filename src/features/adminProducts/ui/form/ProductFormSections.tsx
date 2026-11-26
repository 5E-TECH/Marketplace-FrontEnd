import { App, Dropdown } from 'antd';
import { ArrowRight, Check, ChevronDown, CircleCheck, CircleX, FileText, ImageIcon, ImagePlus, MoreHorizontal, Play, Trash2, Upload } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCategoryPoliciesQuery, useGlobalPolicyQuery } from '../../../categories/api/categoryPolicyApi';
import { useAdminCategoriesQuery } from '../../../categories/api/categoryQueries';
import type { Category } from '../../../categories/model/categoryTypes';
import { useWholesalersQuery } from '../../../wholesalers/api/wholesalersQueries';
import { hasContract, productBlock } from '../../../wholesalers/lib/wholesalerRules';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { groupMoneyDigits } from '../../../../shared/lib/money';
import { shortPersonName } from '../../../../shared/lib/personName';
import { tashkentDateTime, tashkentDay } from '../../../../shared/lib/tashkentTime';
import { Badge } from '../../../../shared/ui/Badge/Badge';
import { formatMoney } from '../../../../shared/ui/MoneyText/formatMoney';
import { SafeImage } from '../../../../shared/ui/SafeImage/SafeImage';
import { StatusBadge } from '../../../../shared/ui/StatusBadge/StatusBadge';
import { useCreativesQuery, useDeleteCertificateMutation, usePriceDecisionsQuery, useProductPricingQuery, useSetMainImageMutation } from '../../api/adminProductsQueries';
import { MEDIA_ACCEPT } from '../../lib/creativeLimits';
import type { AdminProduct, Creative } from '../../model/adminProductTypes';
import { DeleteCreativeDialog } from '../CreativeDialogs';
import { CertificateDialog } from './CertificateDialog';
import { ProductMediaDialog, type AddedMedia } from './ProductMediaDialog';
import { errorText, inheritedFlag, moneyDigits, productSlug, WHOLESALER_BLOCK_ERRORS, type ProductErrors, type ProductField, type ProductFormValues } from '../../model/productForm';
import styles from './ProductForm.module.css';

export interface ProductFormSectionsProps {
  values: ProductFormValues;
  errors: ProductErrors;
  onChange: (patch: Partial<ProductFormValues>) => void;
  /** Saqlangan mahsulot (tahrir) — `null` bo'lsa yangi. */
  product: AdminProduct | null;
  slugTouched: boolean;
  onSlugTouched: () => void;
  phone: boolean;
  /** Slug band bo'lgan mahsulot nomi (409 `conflictWith`, taklif). */
  conflictName?: string | null;
}

function Section({ id, title, description, action, children }: { id: string; title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id={id}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className={styles.sectionAction}>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function FieldShell({ id, field, label, required, error, hint, children, wide }: { id: string; field: ProductField; label: string; required?: boolean; error?: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={styles.field} data-wide={wide || undefined} data-field={field}>
      <div className={styles.labelRow}><label htmlFor={id}>{label}{required ? <span aria-hidden> *</span> : null}</label></div>
      {children}
      {error ? <p className={styles.error} id={`${id}-h`}><CircleX aria-hidden /><span>{error}</span></p> : hint ? <p className={styles.hint} id={`${id}-h`}>{hint}</p> : null}
    </div>
  );
}

/** Kategoriya daraxti — daraxt tartibida, faqat nomi (dizayn va «Mahsulotlar» filtri kabi; ota — «Kategoriyadan meros» da). */
function flatCategories(items: readonly Category[]): { id: string; label: string }[] {
  return items.flatMap((item) => [{ id: item.id, label: item.name }, ...flatCategories(item.children)]);
}

function categoryName(categories: readonly Category[], id: string | null): string | null {
  for (const item of categories) {
    if (item.id === id) return item.name;
    const nested = categoryName(item.children, id);
    if (nested) return nested;
  }
  return null;
}

/**
 * Mahsulot formasi bo'limlari (admin-mahsulot-karta «Asosiy»): Optovik, Mahsulot, Rasm va video, Og'irlik va o'lcham,
 * Yetkazish (sotuvga chiqmagan mahsulotda), Sertifikat va toifa (BAD, muddat, BE-41 MXIK va qadoq kodi), Bazaviy narx.
 * Yangi mahsulotda «Sertifikat va toifa» yo'q — BAD va muddat kategoriyadan, sertifikat saqlangandan keyin (…holatlar).
 */
export function ProductFormSections(props: ProductFormSectionsProps) {
  const { values, errors, onChange, product, slugTouched, onSlugTouched, conflictName, phone } = props;
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const removeCertificate = useDeleteCertificateMutation();
  const [certificateOpen, setCertificateOpen] = useState(false);
  const ids = {
    wholesaler: useId(), name: useId(), slug: useId(), category: useId(), subtitle: useId(), description: useId(),
    weight: useId(), length: useId(), width: useId(), height: useId(), price: useId(), mxik: useId(), pack: useId(), media: useId(),
  };
  const wholesalers = useWholesalersQuery();
  const categories = useAdminCategoriesQuery();
  const tree = categories.data ?? [];
  const err = (field: ProductField) => errorText(field, errors[field], t, { conflictName, slug: values.slug });
  const selected = wholesalers.data?.find((item) => item.id === values.wholesalerId) ?? null;
  // Yangi mahsulot: shartnomasiz, to'xtatilgan yoki tasdiqlanmagan optovikka qo'shib bo'lmaydi (OPT-1, `productBlock`).
  const block = selected && !product ? productBlock(selected) : null;
  const wholesalerError = err('wholesalerId') ?? (block ? errorText('wholesalerId', WHOLESALER_BLOCK_ERRORS[block], t) : undefined);

  const input = (field: ProductField, id: string, extra: { placeholder?: string; unit?: string; inputMode?: 'decimal' | 'numeric'; onValue?: (value: string) => void } = {}) => (
    <div className={styles.control} data-unit={extra.unit ? true : undefined}>
      <input
        id={id}
        value={String(values[field] ?? '')}
        placeholder={extra.placeholder}
        inputMode={extra.inputMode}
        autoComplete="off"
        aria-invalid={err(field) ? true : undefined}
        aria-describedby={`${id}-h`}
        onChange={(event) => (extra.onValue ? extra.onValue(event.target.value) : onChange({ [field]: event.target.value }))}
      />
      {extra.unit ? <span className={styles.unit} aria-hidden>{extra.unit}</span> : null}
    </div>
  );

  return (
    <>
      <Section id="apf-wholesaler" title={t('apf.wholesaler.title')} description={t('apf.wholesaler.text')}>
        <div className={styles.wholesalerGrid}>
          <FieldShell id={ids.wholesaler} field="wholesalerId" label={t('apf.field.wholesalerId')} required error={wholesalerError} hint={t('apf.wholesaler.hint')}>
            <div className={styles.select}>
              <select id={ids.wholesaler} value={values.wholesalerId} disabled={Boolean(product)} aria-invalid={wholesalerError ? true : undefined} aria-describedby={`${ids.wholesaler}-h`} onChange={(event) => onChange({ wholesalerId: event.target.value })}>
                <option value="" disabled>{t('apf.wholesaler.choose')}</option>
                {(wholesalers.data ?? []).filter((item) => item.status === 'ACTIVE' || item.id === values.wholesalerId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <ChevronDown aria-hidden />
            </div>
          </FieldShell>
          <div className={styles.contractSide}>
            <p className={styles.caption}>{t('apf.wholesaler.contract')}</p>
            {selected ? (
              hasContract(selected) ? <Badge tone="success" icon={CircleCheck}>{t('status.contract.SIGNED')}</Badge> : (
                <>
                  <Badge tone="warning">{t('apf.wholesaler.unsigned')}</Badge>
                  <Link className={styles.link} to={`/admin/wholesalers/${encodeURIComponent(selected.id)}?dialog=contract`}>{t('apf.wholesaler.upload')}</Link>
                </>
              )
            ) : <span className={styles.muted}>{t('apf.wholesaler.afterChoose')}</span>}
            {product?.createdByName ? <span className={styles.muted}>{t('apf.wholesaler.by', { who: shortPersonName(product.createdByName), when: tashkentDateTime(product.createdAt) })}</span> : null}
          </div>
        </div>
      </Section>

      <Section id="apf-product" title={t('apf.product.title')} description={t('apf.product.text')}>
        <div className={styles.grid2}>
          <FieldShell id={ids.name} field="name" label={t('apf.field.name')} required error={err('name')}>
            {input('name', ids.name, { placeholder: t('apf.product.namePlaceholder'), onValue: (name) => onChange(slugTouched ? { name } : { name, slug: productSlug(name) }) })}
          </FieldShell>
          <FieldShell id={ids.slug} field="slug" label={t('apf.field.slug')} required error={err('slug')} hint={t('apf.product.slugHint')}>
            {input('slug', ids.slug, { placeholder: t('apf.product.slugPlaceholder'), onValue: (slug) => { onSlugTouched(); onChange({ slug: slug.toLowerCase() }); } })}
          </FieldShell>
          <FieldShell id={ids.category} field="categoryId" label={t('apf.field.categoryId')} required error={err('categoryId')} hint={values.categoryId ? undefined : t('apf.product.categoryHint')}>
            <div className={styles.select}>
              <select id={ids.category} value={values.categoryId} aria-invalid={err('categoryId') ? true : undefined} aria-describedby={`${ids.category}-h`} onChange={(event) => onChange({ categoryId: event.target.value })}>
                <option value="" disabled>{t('apf.product.categoryChoose')}</option>
                {flatCategories(tree).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <ChevronDown aria-hidden />
            </div>
          </FieldShell>
          {values.categoryId ? <InheritBox categories={tree} categoryId={values.categoryId} /> : null}
          <FieldShell id={ids.subtitle} field="subtitle" label={t('apf.field.subtitle')} wide={Boolean(values.categoryId)}>
            {input('subtitle', ids.subtitle, { placeholder: t('apf.product.subtitlePlaceholder') })}
          </FieldShell>
          <FieldShell id={ids.description} field="description" label={t('apf.field.description')} required error={err('description')} hint={t('apf.product.descriptionHint')} wide>
            <textarea
              id={ids.description}
              className={styles.textarea}
              value={values.description}
              aria-invalid={err('description') ? true : undefined}
              aria-describedby={`${ids.description}-h`}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </FieldShell>
        </div>
      </Section>

      <MediaSection {...props} inputId={ids.media} />

      <Section id="apf-size" title={t('apf.size.title')} description={t('apf.size.text')}>
        <div className={styles.grid4}>
          <FieldShell id={ids.weight} field="weightKg" label={t('apf.field.weightKg')} required error={err('weightKg')}>{input('weightKg', ids.weight, { placeholder: '0.0', unit: 'kg', inputMode: 'decimal' })}</FieldShell>
          <FieldShell id={ids.length} field="lengthCm" label={t('apf.field.lengthCm')} required error={err('lengthCm')}>{input('lengthCm', ids.length, { placeholder: '0', unit: t('apf.cm'), inputMode: 'decimal' })}</FieldShell>
          <FieldShell id={ids.width} field="widthCm" label={t('apf.field.widthCm')} required error={err('widthCm')}>{input('widthCm', ids.width, { placeholder: '0', unit: t('apf.cm'), inputMode: 'decimal' })}</FieldShell>
          <FieldShell id={ids.height} field="heightCm" label={t('apf.field.heightCm')} required error={err('heightCm')}>{input('heightCm', ids.height, { placeholder: '0', unit: t('apf.cm'), inputMode: 'decimal' })}</FieldShell>
        </div>
        <p className={styles.note}>{t('apf.size.note')}</p>
      </Section>

      {product && product.status !== 'ACTIVE' ? <DeliverySection product={product} category={categoryName(tree, product.categoryId)} /> : null}

      {product ? (
        <Section
          id="apf-cert"
          title={t('apf.cert.title')}
          description={t('apf.cert.text')}
          action={<button type="button" className={styles.smallButton} onClick={() => setCertificateOpen(true)}><Upload aria-hidden />{t('apf.cert.add')}</button>}
        >
          <ul className={styles.certs}>
            {product.certificate ? (
              <li>
                <span className={styles.fileIcon} aria-hidden><FileText /></span>
                <span className={styles.fileBody}>
                  <span className={styles.fileTop}>
                    <span className={styles.fileName}>{product.certificate.name}</span>
                    <span className={styles.fileDate}>{tashkentDay(product.certificate.uploadedAt)}</span>
                  </span>
                  <span className={styles.fileState}><CircleCheck aria-hidden /><span>{t('apf.cert.uploaded')}</span></span>
                </span>
                <button
                  type="button"
                  className={styles.iconButton}
                  disabled={removeCertificate.isPending}
                  aria-label={t('apf.cert.remove', { name: product.certificate.name })}
                  title={t('apf.cert.remove', { name: product.certificate.name })}
                  onClick={() => removeCertificate.mutate(product.id, {
                    onSuccess: () => notification.success({ title: t('apf.cert.removed'), placement: phone ? 'top' : 'bottomRight', duration: 3 }),
                    onError: (error) => notification.error({ title: t('apf.cert.removeError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' }),
                  })}
                >
                  <Trash2 aria-hidden />
                </button>
              </li>
            ) : <li className={styles.certEmpty}>{t('apf.cert.none')}</li>}
          </ul>
          <div className={styles.grid2} data-tight>
            <FlagTile label={t('apf.flag.bad')} flag={values.isBad} inherited={effectiveFlag(product, tree, values.categoryId, 'isBad')} onChange={(isBad) => onChange({ isBad })} />
            <FlagTile label={t('apf.flag.expiry')} flag={values.expiryTracked} inherited={effectiveFlag(product, tree, values.categoryId, 'expiryTracked')} onChange={(expiryTracked) => onChange({ expiryTracked })} expiry />
            <FieldShell id={ids.mxik} field="mxikCode" label={t('apf.field.mxikCode')} error={err('mxikCode')} hint={t('apf.cert.mxikHint')}>
              {input('mxikCode', ids.mxik, { placeholder: '03304001001000000', inputMode: 'numeric', onValue: (value) => onChange({ mxikCode: value.replace(/\D/g, '').slice(0, 17) }) })}
            </FieldShell>
            <FieldShell id={ids.pack} field="packageCode" label={t('apf.field.packageCode')} error={err('packageCode')} hint={t('apf.cert.packageHint')}>
              {input('packageCode', ids.pack, { placeholder: '1500012', inputMode: 'numeric', onValue: (value) => onChange({ packageCode: value.replace(/\D/g, '').slice(0, 20) }) })}
            </FieldShell>
          </div>
          <p className={styles.note}>{t('apf.cert.note')}</p>
        </Section>
      ) : null}

      <PriceSection values={values} error={err('basePrice')} onChange={onChange} product={product} inputId={ids.price} />
      {certificateOpen && product ? <CertificateDialog product={product} onClose={() => setCertificateOpen(false)} /> : null}
    </>
  );
}

/**
 * Meros qiymati: kategoriya o'zgarmagan bo'lsa — backend hisoblagani (`badByCategory`, samarali `expiryTracked`),
 * aks holda — tanlangan kategoriya daraxtidan.
 */
function effectiveFlag(product: AdminProduct, tree: readonly Category[], categoryId: string, flag: 'isBad' | 'expiryTracked') {
  const inherited = inheritedFlag(tree, categoryId, flag);
  if (categoryId !== (product.categoryId ?? '')) return inherited;
  const backend = flag === 'isBad' ? product.badByCategory : product.expiryTracked;
  return typeof backend === 'boolean' ? { ...inherited, value: backend } : inherited;
}

/** «Kategoriyadan meros»: ustama va yetkazish — narx qatlamidan (kategoriya → global), BAD va muddat — daraxtdan. */
function InheritBox({ categories, categoryId }: { categories: readonly Category[]; categoryId: string }) {
  const { t } = useTranslation();
  const global = useGlobalPolicyQuery().data;
  const layer = useCategoryPoliciesQuery([categoryId]).get(categoryId);
  const bad = inheritedFlag(categories, categoryId, 'isBad');
  const expiry = inheritedFlag(categories, categoryId, 'expiryTracked');
  const markup = layer?.markupCapPercent ?? global?.markupCapPercent ?? null;
  const mode = layer?.deliveryMode ?? global?.deliveryMode ?? null;
  const parent = (from: string | null) => (from ? ` ${t('apf.inherit.parent')}` : '');
  const parts = [
    markup === null ? null : t('apf.inherit.markup', { percent: markup }),
    mode ? t('apf.inherit.delivery', { mode: t(`apf.mode.${mode}` as TranslationKey) }) : null,
    `${t(bad.value ? 'apf.inherit.badYes' : 'apf.inherit.badNo')}${parent(bad.from)}`,
    `${t(expiry.value ? 'apf.inherit.expiryOn' : 'apf.inherit.expiryOff')}${parent(expiry.from)}`,
  ].filter(Boolean);
  return (
    <div className={styles.inherit} data-testid="category-inherit">
      <span>{t('apf.inherit.title')}</span>
      {parts.join(' · ')}
    </div>
  );
}

function FlagTile({ label, flag, inherited, onChange, expiry = false }: { label: string; flag: boolean | null; inherited: { value: boolean; from: string | null }; onChange: (value: boolean | null) => void; expiry?: boolean }) {
  const { t } = useTranslation();
  const own = flag !== null;
  const source = inherited.from ? t('apf.flag.fromParent', { name: inherited.from }) : t('apf.flag.fromCategory');
  const inheritedText = expiry ? t(inherited.value ? 'apf.flag.tracked' : 'apf.flag.notTracked') : t(inherited.value ? 'apf.yes' : 'apf.no');
  return (
    <div className={styles.flag}>
      <label className={styles.check}>
        <span className={styles.box}>
          <input type="checkbox" checked={flag ?? inherited.value} disabled={!own} onChange={(event) => onChange(event.target.checked)} />
          <Check aria-hidden />
        </span>
        <span>{label}</span>
      </label>
      <p>
        {own ? `${t('apf.flag.own')} · ` : `${source}: ${inheritedText} · `}
        <button type="button" className={styles.linkButton} onClick={() => onChange(own ? null : inherited.value)}>{t(own ? 'apf.flag.reset' : 'apf.flag.override')}</button>
      </p>
    </div>
  );
}

interface MediaItem { key: string; video: boolean; url: string; caption: string | null; creative: Creative | null }
type MediaDialog = { files: File[] } | null;

/**
 * «Rasm va video»: yangi mahsulotda — oldindan yuklash (taklif §9), kamida bitta rasm; saqlangan mahsulotda — kreativlar
 * kutubxonasi (BE-08). Qo'shish — «Rasm va video qo'shish» oynasi (kataklardagi «Qo'shish» tanlangan fayllar bilan ochadi).
 * Sotuvchi sahifasida 4:5 ramka, birinchi rasm — asosiy.
 */
function MediaSection({ values, errors, onChange, product, inputId }: ProductFormSectionsProps & { inputId: string }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const creatives = useCreativesQuery(product?.id).data;
  const setMain = useSetMainImageMutation();
  const [dialog, setDialog] = useState<MediaDialog>(null);
  const [deleting, setDeleting] = useState<Creative | null>(null);
  const err = errorText('images', errors.images, t);

  const items: MediaItem[] = product
    ? (creatives ?? []).map((creative) => ({ key: creative.id, video: creative.type === 'VIDEO', url: creative.url, caption: creative.caption ?? null, creative }))
    : [...values.videos.map((url) => ({ key: url, video: true, url, caption: null, creative: null })), ...values.images.map((url) => ({ key: url, video: false, url, caption: null, creative: null }))];
  const imageCount = items.filter((item) => !item.video).length;
  const videoCount = items.length - imageCount;
  const empty = !items.length;
  // Rasm tartib raqami — faqat rasmlar orasida; birinchi video va birinchi rasm — «asosiy» (izoh kelmasa).
  const firstVideo = items.findIndex((item) => item.video);
  const labels = items.map((item, index) => {
    if (item.video) return { label: t('apf.media.video'), caption: item.caption ?? (index === firstVideo ? t('apf.media.main') : '') };
    const order = items.slice(0, index + 1).filter((entry) => !entry.video).length;
    return { label: t('apf.media.image', { index: order, total: imageCount }), caption: item.caption ?? (order === 1 ? t('apf.media.main') : '') };
  });

  const added = (media: AddedMedia[], makeMain: boolean) => {
    const images = media.filter((item) => item.type === 'IMAGE').map((item) => item.url);
    const videos = media.filter((item) => item.type === 'VIDEO').map((item) => item.url);
    onChange({ images: makeMain ? [...images, ...values.images] : [...values.images, ...images], videos: [...values.videos, ...videos] });
  };

  const makeMain = (url: string) => {
    if (!product) {
      onChange({ images: [url, ...values.images.filter((item) => item !== url)] });
      return;
    }
    setMain.mutate({ id: product.id, url, images: product.images }, {
      onSuccess: () => notification.success({ title: t('apf.media.mainSet'), placement: 'bottomRight', duration: 3 }),
      onError: (error) => notification.error({ title: t('apf.saveError'), description: getApiErrorMessage(error), placement: 'bottomRight' }),
    });
  };

  const menuFor = (item: MediaItem, label: string) => {
    const isMain = product ? product.images[0] === item.url : values.images[0] === item.url;
    const menuItems = [
      ...(!item.video && !isMain ? [{ key: 'main', label: t('apf.media.makeMain') }] : []),
      ...(product ? [{ key: 'library', label: t('apf.media.library') }] : []),
      { key: 'remove', label: t('apf.media.removeShort'), danger: true },
    ];
    return (
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: menuItems,
          onClick: ({ key }) => {
            if (key === 'library') void navigate('?tab=creatives');
            if (key === 'main') makeMain(item.url);
            if (key === 'remove' && item.creative) setDeleting(item.creative);
            if (key === 'remove' && !product) onChange({ images: values.images.filter((url) => url !== item.url), videos: values.videos.filter((url) => url !== item.url) });
          },
        }}
      >
        <button type="button" className={styles.mediaMenu} aria-label={t('apf.media.actions', { name: label })} title={t('apf.media.actions', { name: label })}><MoreHorizontal aria-hidden /></button>
      </Dropdown>
    );
  };

  return (
    <Section
      id="apf-media"
      title={t('apf.media.title')}
      description={items.length ? t('apf.media.count', { videos: videoCount, images: imageCount }) : t('apf.media.text')}
      action={<button type="button" className={styles.smallButton} onClick={() => setDialog({ files: [] })}><Upload aria-hidden />{t('apf.media.add')}</button>}
    >
      <ul className={styles.media} data-testid="product-media">
        {items.map((item, index) => (
          <li key={item.key}>
            <div className={styles.mediaTile}>
              {item.video ? <Play aria-hidden /> : <ImageIcon aria-hidden />}
              {item.video ? null : <SafeImage src={item.url} alt="" />}
              {menuFor(item, labels[index].label)}
            </div>
            <span className={styles.mediaLabel}>
              <span>{labels[index].label}</span>
              {labels[index].caption ? <span>{labels[index].caption}</span> : null}
            </span>
          </li>
        ))}
        <li>
          <div className={styles.addWrap} data-field="images">
            <label htmlFor={inputId} className={styles.addTile} data-invalid={err ? true : undefined}><ImagePlus aria-hidden />{t(empty ? 'apf.media.addFirst' : 'apf.media.addShort')}</label>
            <input
              id={inputId}
              type="file"
              multiple
              accept={MEDIA_ACCEPT}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? `${inputId}-h` : undefined}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (files.length) setDialog({ files });
              }}
            />
          </div>
        </li>
        {empty ? [1, 2, 3].map((slot) => <li key={slot} aria-hidden data-slot={slot}><div className={styles.slot} /></li>) : null}
      </ul>
      {err ? <p className={styles.error} id={`${inputId}-h`}><CircleX aria-hidden /><span>{err}</span></p> : null}
      <p className={styles.note}>{t('apf.media.note')} <span>{t('whs.tbd')}</span></p>
      {dialog ? (
        <ProductMediaDialog
          product={product}
          productName={product?.name ?? (values.name.trim() || t('apf.newTitle'))}
          counts={{ videos: videoCount, images: imageCount }}
          initialFiles={dialog.files}
          onAdded={added}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {deleting && product ? <DeleteCreativeDialog product={product} creative={deleting} creatives={creatives ?? []} onClose={() => setDeleting(null)} /> : null}
    </Section>
  );
}

/**
 * «Yetkazish — kategoriyadan / mahsulotda o'zida / globaldan» (…holatlar: qoralama va moderatsiyadagi mahsulot): rejim,
 * markazgacha va eshikkacha summa, yashirilgan qism tavsiya narxga qanday ta'sir qiladi. Hisob — serverdan (BE-09).
 */
function DeliverySection({ product, category }: { product: AdminProduct; category: string | null }) {
  const { t } = useTranslation();
  const pricing = useProductPricingQuery(product.id).data;
  if (!pricing) return null;
  const { delivery } = pricing.calculation;
  const mode = pricing.params.deliveryMode;
  const source = pricing.params.deliveryModeSource ?? 'GLOBAL';
  const sum = (value: number) => t('whs.money', { amount: formatMoney(value) });
  const sourceText = source === 'PRODUCT' ? t('apf.delivery.fromProduct') : source === 'CATEGORY' && category ? t('apf.delivery.fromCategoryName', { name: category }) : t('apf.delivery.fromGlobal');
  const grams = product.weightGrams ?? 0;
  const kg = String(grams / 1000);
  const extraKg = Math.max(0, Math.ceil((grams - pricing.tariff.baseWeightGrams) / 1000));
  const centerSub = extraKg
    ? t('apf.delivery.centerFormula', { base: formatMoney(pricing.tariff.centerBase), extra: extraKg, perKg: formatMoney(pricing.tariff.perExtraKg), kg })
    : t('apf.delivery.centerBase', { kg, baseKg: pricing.tariff.baseWeightGrams / 1000 });
  const note = delivery.hiddenPriceAdd > 0
    ? t('apf.delivery.noteHidden', { mode: t(`apf.modeTitle.${mode}` as TranslationKey), hidden: formatMoney(delivery.hidden), recommended: formatMoney(pricing.calculation.recommendedBase), customer: formatMoney(pricing.calculation.recommended) })
    : t('apf.delivery.noteNone', { mode: t(`apf.modeTitle.${mode}` as TranslationKey), recommended: formatMoney(pricing.calculation.recommended) });
  const title = source === 'PRODUCT' ? 'apf.delivery.titleProduct' : source === 'CATEGORY' ? 'apf.delivery.titleCategory' : 'apf.delivery.titleGlobal';
  return (
    <Section id="apf-delivery" title={t(title)} description={t('apf.delivery.text')}>
      <dl className={styles.rows}>
        <div><dt>{t('apf.delivery.mode')}</dt><dd>{t(`apf.modeTitle.${mode}` as TranslationKey)}<span className={styles.sub}>{sourceText}</span></dd></div>
        <div><dt>{t('apf.delivery.center')}</dt><dd>{sum(delivery.visibleCenter)}<span className={styles.sub}>{centerSub}</span></dd></div>
        <div>
          <dt>{t('apf.delivery.door')}</dt>
          <dd>{sum(delivery.visibleAddress)}<span className={styles.sub}>{t('apf.delivery.doorSub', { center: formatMoney(delivery.visibleCenter), extra: formatMoney(Math.max(0, delivery.visibleAddress - delivery.visibleCenter)) })}</span></dd>
        </div>
      </dl>
      <p className={styles.note}>{note}</p>
    </Section>
  );
}

function PriceSection({ values, error, onChange, product, inputId }: { values: ProductFormValues; error?: string; onChange: (patch: Partial<ProductFormValues>) => void; product: AdminProduct | null; inputId: string }) {
  const { t } = useTranslation();
  const pricing = useProductPricingQuery(product?.id).data;
  const approved = product ? product.approvedPrice !== null : false;
  const decision = usePriceDecisionsQuery(approved ? product?.id : undefined).data?.[0];
  const sum = (value: number) => t('whs.money', { amount: formatMoney(value) });
  const delivery = pricing?.calculation.delivery.visibleCenter ?? 0;
  const customer = pricing ? pricing.approvedPrice ?? pricing.calculation.recommended : null;
  const status = approved ? pricing?.priceStatus ?? null : null;
  return (
    <Section id="apf-price" title={t('apf.price.title')}>
      <div className={styles.grid2} data-wide-gap>
        <FieldShell id={inputId} field="basePrice" label={t('apf.field.basePrice')} required error={error} hint={t('apf.price.hint')}>
          <div className={styles.control} data-unit="wide">
            <input id={inputId} value={groupMoneyDigits(moneyDigits(values.basePrice))} placeholder="0" inputMode="numeric" autoComplete="off" aria-invalid={error ? true : undefined} aria-describedby={`${inputId}-h`} onChange={(event) => onChange({ basePrice: moneyDigits(event.target.value) })} />
            <span className={styles.unit} aria-hidden>{t('whs.kpi.payableUnit')}</span>
          </div>
        </FieldShell>
        <div className={styles.system}>
          <p className={styles.caption}>{t(pricing ? 'apf.price.system' : 'apf.price.systemNew')}</p>
          {pricing && customer !== null ? (
            <>
              <dl className={styles.rows}>
                <div><dt>{t('apf.price.recommended')}</dt><dd>{sum(pricing.calculation.recommendedBase)}<span className={styles.sub}>{t('apf.price.recommendedSub')}</span></dd></div>
                <div><dt>{t('apf.price.customer')}</dt><dd>{`${sum(customer)} + ${sum(delivery)}`}<span className={styles.sub}>{t('apf.price.customerSub', { mode: t(`moderation.mode.${pricing.params.deliveryMode}` as TranslationKey) })}</span></dd></div>
                <div>
                  <dt>{t('apf.price.status')}</dt>
                  <dd>
                    {status ? <StatusBadge family="price" code={status} /> : t('apf.price.notApproved')}
                    {decision ? <span className={styles.sub}>{[tashkentDay(decision.createdAt), decision.decidedByName ? shortPersonName(decision.decidedByName) : null].filter(Boolean).join(' · ')}</span> : null}
                  </dd>
                </div>
              </dl>
              <div><Link to="?tab=price" className={styles.link}>{t('apf.price.tab')}<ArrowRight aria-hidden /></Link></div>
            </>
          ) : <p className={styles.systemText}>{t('apf.price.systemText')}</p>}
        </div>
      </div>
      {product ? <p className={styles.note}>{t('apf.price.note')}</p> : null}
    </Section>
  );
}
