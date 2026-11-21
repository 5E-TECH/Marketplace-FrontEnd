import { Check, ChevronDown, CircleAlert, FolderPlus, Pencil } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useSaveCategoryPolicyMutation, type ElchiTariff, type PolicyLayer, type PolicyValues } from '../../../features/categories/api/categoryPolicyApi';
import { useCreateCategoryMutation, useUpdateCategoryMutation } from '../../../features/categories/api/categoryQueries';
import { categorySlug, SLUG_PATTERN } from '../../../features/categories/lib/categorySlug';
import type { Category, CategoryPatch } from '../../../features/categories/model/categoryTypes';
import { getApiErrorCode, getApiErrorMessage } from '../../../shared/api/apiError';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { MoneyInput } from '../../../shared/ui/MoneyInput/MoneyInput';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { modeLabel } from '../model/categoryLabels';
import { flatten, parentChain, resolveFlag, type FlagKey } from '../model/categoryRows';
import styles from '../AdminCategoriesPage.module.css';

type Mode = NonNullable<PolicyValues['deliveryMode']>;
const MODES: Mode[] = ['SEPARATE', 'PARTIAL', 'FREE'];

interface Values {
  name: string;
  slug: string;
  parentId: string;
  markup: string;
  mode: Mode | '';
  center: number | null;
  door: number | null;
  bad: boolean;
  expiry: boolean;
}

interface CategoryFormDialogProps {
  /** Tahrirlanadigan kategoriya; `null` — yangi (sayt menyusining oxiriga). */
  category: Category | null;
  /** Yangi kategoriyaning otasi («Ichiga kategoriya qo'shish»). */
  parentId: string | null;
  tree: readonly Category[];
  /** Kategoriyaning o'z narx qatlami (`null` qiymat — globaldan). */
  layer: PolicyLayer | undefined;
  global: PolicyLayer | undefined;
  tariff: ElchiTariff | null | undefined;
  /** Pul parametrlari — SUPERADMIN (`PUT /admin/pricing/policy/categories/{id}`). */
  canEditPolicy: boolean;
  /** Telefonda yetkazish rejimi — radio qatorlar (holatlar Ph4, R7). */
  phone: boolean;
  onClose: () => void;
  onSaved: (category: Category, created: boolean) => void;
}

const percentValue = (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.')));

/**
 * Kategoriya qo'shish va tahrirlash (admin-kategoriyalar holatlar 3–4): nom, slug, ota kategoriya va parametrlar —
 * bo'sh qiymat global sukutdan yoki ota kategoriyadan. Kategoriya — `/admin/categories`, pul parametrlari —
 * narx sozlamasi qatlami. Slug, BAD va muddat — taklif (fe-12 §9), o'zgargandagina yuboriladi.
 */
export function CategoryFormDialog({ category, parentId, tree, layer, global, tariff, canEditPolicy, phone, onClose, onSaved }: CategoryFormDialogProps) {
  const { t } = useTranslation();
  const flat = useMemo(() => flatten(tree), [tree]);
  const create = useCreateCategoryMutation();
  const update = useUpdateCategoryMutation();
  const savePolicy = useSaveCategoryPolicyMutation();
  const [target, setTarget] = useState(category);
  /** Oyna ochilgandagi holat (ma'lumot qayta yuklansa ham «o'zgardimi» shu bilan solishtiriladi). */
  const [initial] = useState<Values>(() => {
    const parents = parentChain(flat, category ? category.parentId : parentId);
    return {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      parentId: (category ? category.parentId : parentId) ?? '',
      markup: layer?.markupCapPercent === null || layer?.markupCapPercent === undefined ? '' : String(layer.markupCapPercent),
      mode: layer?.deliveryMode ?? '',
      center: layer?.visibleCenter ?? null,
      door: layer?.visibleAddress ?? null,
      bad: resolveFlag(category?.isBad, parents, 'isBad').value,
      expiry: resolveFlag(category?.expiryTracked, parents, 'expiryTracked').value,
    };
  });
  const [values, setValues] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(category && category.slug !== categorySlug(category.name)));
  const [showErrors, setShowErrors] = useState(false);
  const [serverSlugError, setServerSlugError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const slug = slugTouched ? values.slug : categorySlug(values.name);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((previous) => ({ ...previous, [key]: value }));
  const parents = parentChain(flat, values.parentId || null);
  const excluded = new Set(category ? flatten([category]).map((item) => item.id) : []);
  const duplicate = flat.find((item) => item.slug === slug && item.id !== target?.id);
  const markup = percentValue(values.markup);

  const errors = {
    name: values.name.trim() ? '' : t('acat.form.nameRequired'),
    slug: !slug ? t('acat.form.slugRequired') : !SLUG_PATTERN.test(slug) ? t('acat.form.slugPattern') : duplicate ? t('acat.form.slugTaken', { name: duplicate.name }) : serverSlugError,
    markup: markup !== null && !(Number.isFinite(markup) && markup >= 0 && markup <= 100) ? t('acat.form.markupRange') : '',
    center: tariff && values.center !== null && values.center > tariff.center ? t('acat.form.overTariff', { amount: formatMoney(tariff.center) }) : '',
    door: tariff && values.door !== null && values.door > tariff.address ? t('acat.form.overTariff', { amount: formatMoney(tariff.address) }) : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const policy: PolicyValues = { markupCapPercent: markup, deliveryMode: values.mode || null, visibleCenter: values.center, visibleAddress: values.door };
  /** Tahrirda kategoriya qatlami hali kelmagan bo'lsa — pul parametrlari yopiq va yuborilmaydi (ustidan yozilmasin). */
  const layerUnknown = Boolean(category) && layer === undefined;
  const policyChanged = canEditPolicy && !layerUnknown && (
    policy.markupCapPercent !== (layer?.markupCapPercent ?? null) || policy.deliveryMode !== (layer?.deliveryMode ?? null)
    || policy.visibleCenter !== (layer?.visibleCenter ?? null) || policy.visibleAddress !== (layer?.visibleAddress ?? null)
  );

  /** Meros qiymatiga teng — `null` (otadan); saqlangan qiymatdan farq qilsagina yuboriladi. */
  const flagPatch = (key: FlagKey, checked: boolean): CategoryPatch => {
    const inherited = resolveFlag(null, parents, key).value;
    const next = checked === inherited ? null : checked;
    return next === (target?.[key] ?? null) ? {} : { [key]: next };
  };

  /**
   * Backend slugni nomdan yaratadi (nom yuborilsa — qayta). Shu sababli: nomdan hosil bo'ladigan slug — nom bilan,
   * boshqasi — `slug` maydoni bilan (taklif) yuboriladi; o'zgarmagan maydon yuborilmaydi.
   */
  const categoryPatch = (): CategoryPatch => {
    const name = values.name.trim();
    const custom = slug !== categorySlug(name);
    const flags = { ...flagPatch('isBad', values.bad), ...flagPatch('expiryTracked', values.expiry) };
    if (!target) {
      const siblings = flat.filter((item) => item.parentId === (values.parentId || null));
      const sortOrder = siblings.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0);
      return { name, parentId: values.parentId || null, sortOrder, isActive: true, ...(custom ? { slug } : {}), ...flags };
    }
    const nameChanged = name !== target.name;
    const slugChanged = slug !== target.slug;
    return {
      ...(nameChanged || (slugChanged && !custom) ? { name } : {}),
      ...((nameChanged || slugChanged) && custom ? { slug } : {}),
      ...((values.parentId || null) !== target.parentId ? { parentId: values.parentId || null } : {}),
      ...flags,
    };
  };

  const dirty = !category || JSON.stringify({ ...values, slug }) !== JSON.stringify({ ...initial, slug: category.slug });

  const save = async () => {
    setShowErrors(true);
    if (invalid || saving || !dirty) return;
    setSaving(true);
    setError('');
    try {
      const patch = categoryPatch();
      let saved = target;
      if (!saved) saved = await create.mutateAsync({ name: values.name.trim(), ...patch });
      else if (Object.keys(patch).length) saved = await update.mutateAsync({ id: saved.id, payload: patch });
      setTarget(saved);
      if (policyChanged) await savePolicy.mutateAsync({ id: saved.id, values: policy });
      onSaved(saved, !category);
    } catch (caught) {
      if (getApiErrorCode(caught) === 'CONFLICT') setServerSlugError(t('acat.form.slugTakenServer'));
      else setError(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const inheritedHint = (key: 'visibleCenter' | 'visibleAddress', value: number | null) => {
    const own = (layer?.[key] ?? null) !== null && value !== null;
    const limit = tariff ? ` · ${t('acat.form.tariffLimit', { amount: formatMoney(key === 'visibleCenter' ? tariff.center : tariff.address) })}` : '';
    return own
      ? `${t('acat.src.own')} · ${t('acat.form.globalValue', { amount: formatMoney(global?.[key] ?? 0) })}${limit}`
      : `${t('acat.form.emptyGlobal')}${limit}`;
  };
  const money = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatMoney(value));
  /** Nom va slug xatosi — saqlashga urinilgach; son maydonlari xatosi — darhol. */
  const fieldError = (text: string, live = false) => ((showErrors || live) && text ? <p className={styles.fieldError} role="alert"><CircleAlert aria-hidden />{text}</p> : null);
  const policyLocked = !canEditPolicy || saving || layerUnknown;

  return (
    <Dialog
      open
      title={category ? t('acat.form.editTitle', { name: category.name }) : t('acat.form.addTitle')}
      description={category ? editSummary(t, layer, category) : t('acat.form.addHint')}
      icon={category ? <Pencil /> : <FolderPlus />}
      tone="neutral"
      locked={saving}
      onClose={onClose}
      testId="category-form"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={saving}>{t('acat.cancel')}</DialogCancel>
          <DialogPrimary onClick={() => void save()} disabled={!dirty} saving={saving} savingLabel={t('moderation.saving')} shortcut={false}>
            {t(category ? 'acat.form.save' : 'acat.form.add')}
          </DialogPrimary>
        </>
      )}
    >
      {error ? <p className={styles.formAlert} role="alert"><CircleAlert aria-hidden />{error}</p> : null}
      <Field label={t('acat.form.name')} required htmlFor="category-name">
        <input id="category-name" className={styles.input} value={values.name} maxLength={255} autoFocus disabled={saving} aria-invalid={showErrors && Boolean(errors.name)} onChange={(event) => { setServerSlugError(''); set('name', event.target.value); }} />
        {fieldError(errors.name)}
      </Field>
      <Field label={t('acat.form.slug')} required htmlFor="category-slug">
        <input
          id="category-slug"
          className={styles.input}
          value={slug}
          maxLength={255}
          disabled={saving}
          aria-invalid={Boolean(errors.slug) && (showErrors || Boolean(duplicate))}
          onChange={(event) => { setSlugTouched(true); setServerSlugError(''); set('slug', event.target.value.toLowerCase()); }}
        />
        {errors.slug && (showErrors || duplicate) ? <p className={styles.fieldError} role="alert"><CircleAlert aria-hidden />{errors.slug}</p> : <p className={styles.hint}>{t('acat.form.slugHint', { slug: slug || '…' })}</p>}
      </Field>
      <Field label={t('acat.form.parent')} htmlFor="category-parent">
        <span className={styles.selectWrap}>
          <select id="category-parent" className={styles.input} value={values.parentId} disabled={saving} onChange={(event) => set('parentId', event.target.value)}>
            <option value="">{t('acat.form.topLevel')}</option>
            {flat.filter((item) => !excluded.has(item.id)).map((item) => (
              <option key={item.id} value={item.id}>{`${'   '.repeat(parentChain(flat, item.parentId).length)}${item.name}`}</option>
            ))}
          </select>
          <ChevronDown aria-hidden />
        </span>
      </Field>

      <div className={styles.divider} />
      <div>
        <p className={styles.caption}>{t('acat.params')}</p>
        <p className={styles.formNote}>{t('acat.form.paramsHint')}</p>
        {canEditPolicy ? null : <p className={styles.formNote}>{t('acat.paramsReadOnly')}</p>}
      </div>
      <Field label={t('acat.param.markup')} htmlFor="category-markup">
        <span className={styles.suffixWrap}>
          <input
            id="category-markup"
            className={styles.input}
            inputMode="decimal"
            value={values.markup}
            placeholder={t('acat.form.markupPlaceholder', { value: global?.markupCapPercent ?? '—' })}
            disabled={policyLocked}
            aria-invalid={Boolean(errors.markup)}
            onChange={(event) => set('markup', event.target.value.replace(/[^\d.,]/g, ''))}
          />
          <span aria-hidden>%</span>
        </span>
        {fieldError(errors.markup, true) ?? <p className={styles.hint}>{t('acat.form.markupHint', { value: global?.markupCapPercent ?? '—' })}</p>}
      </Field>
      <div role="radiogroup" aria-label={t('acat.param.mode')} className={styles.modeField}>
        <p className={styles.fieldLabel}>{t('acat.param.mode')}</p>
        <div className={phone ? styles.modeRadios : styles.segmented}>
          {(['', ...MODES] as const).map((mode) => (
            <button
              key={mode || 'global'}
              type="button"
              role="radio"
              aria-checked={values.mode === mode}
              disabled={policyLocked}
              onClick={() => set('mode', mode)}
            >
              {phone ? <span className={styles.radioDot} aria-hidden /> : null}
              {mode ? modeLabel(t, mode) : t('acat.form.modeGlobal')}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.moneyGrid}>
        <Field label={t('acat.form.center')} htmlFor="category-center">
          <MoneyInput id="category-center" value={values.center} disabled={policyLocked} placeholder={t('acat.form.moneyPlaceholder', { amount: money(global?.visibleCenter) })} aria-invalid={Boolean(errors.center)} onChange={(value) => set('center', value)} />
          {fieldError(errors.center, true) ?? (category ? <p className={styles.hint}>{inheritedHint('visibleCenter', values.center)}</p> : null)}
        </Field>
        <Field label={t('acat.form.door')} htmlFor="category-door">
          <MoneyInput id="category-door" value={values.door} disabled={policyLocked} placeholder={t('acat.form.moneyPlaceholder', { amount: money(global?.visibleAddress) })} aria-invalid={Boolean(errors.door)} onChange={(value) => set('door', value)} />
          {fieldError(errors.door, true) ?? (category ? <p className={styles.hint}>{inheritedHint('visibleAddress', values.door)}</p> : null)}
        </Field>
      </div>
      <p className={styles.formNote}>{tariff ? t('acat.form.tariffNote', { center: formatMoney(tariff.center), door: formatMoney(tariff.address) }) : t('acat.form.tariffNoteShort')}</p>
      <div className={styles.checks}>
        <Checkbox checked={values.bad} disabled={saving} label={t('acat.form.bad')} hint={t('acat.form.badHint')} onChange={(checked) => set('bad', checked)} />
        <Checkbox checked={values.expiry} disabled={saving} label={t('acat.form.expiry')} hint={t('acat.form.expiryHint')} onChange={(checked) => set('expiry', checked)} />
      </div>
      <p className={styles.formNote}>{t('acat.form.ordersNote')}</p>
      {category && !dirty ? <p className={styles.formNote}>{t('acat.form.unchanged')}</p> : null}
    </Dialog>
  );
}

/** «Eshikkacha summa shu kategoriyada yozilgan, qolgani global sukutdan». */
function editSummary(t: (key: TranslationKey, params?: Record<string, string | number>) => string, layer: PolicyLayer | undefined, category: Category): string {
  const own = [
    layer?.markupCapPercent !== null && layer?.markupCapPercent !== undefined ? t('acat.form.own.markup') : null,
    layer?.deliveryMode ? t('acat.form.own.mode') : null,
    layer?.visibleCenter !== null && layer?.visibleCenter !== undefined ? t('acat.form.own.center') : null,
    layer?.visibleAddress !== null && layer?.visibleAddress !== undefined ? t('acat.form.own.door') : null,
    typeof category.isBad === 'boolean' ? t('acat.form.own.bad') : null,
    typeof category.expiryTracked === 'boolean' ? t('acat.form.own.expiry') : null,
  ].filter((item): item is string => Boolean(item));
  if (!own.length) return t('acat.form.allInherited');
  const list = own.join(', ');
  return t('acat.form.ownSummary', { list: list.charAt(0).toLocaleUpperCase() + list.slice(1) });
}

function Field({ label, required = false, htmlFor, children }: { label: string; required?: boolean; htmlFor: string; children: ReactNode }) {
  return (
    <div className={styles.formField}>
      <label className={styles.fieldLabel} htmlFor={htmlFor}>{label}{required ? <span className={styles.required} aria-hidden> *</span> : null}</label>
      {children}
    </div>
  );
}

function Checkbox({ checked, disabled, label, hint, onChange }: { checked: boolean; disabled: boolean; label: string; hint: string; onChange: (checked: boolean) => void }) {
  return (
    <div>
      <label className={styles.check}>
        <span className={styles.checkBox}>
          <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
          {checked ? <Check aria-hidden /> : null}
        </span>
        <span>{label}</span>
      </label>
      <p className={styles.checkHint}>{hint}</p>
    </div>
  );
}
