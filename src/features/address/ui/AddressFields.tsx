import { CircleX, RefreshCw } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import { useRegionTree } from '../api/regionsQueries';
import { addressChanged, missingAddressFields, type AddressField, type AddressValue } from '../lib/addressValue';
import styles from './AddressFields.module.css';

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  /**
   * Mijoz yozgan manzil (lid formasidan). Berilsa sarlavha yonida belgi: «Mijoz yozgan»;
   * operator maydonni o'zgartirsa (yoki oldin tuzatgan bo'lsa — `editedBefore`) «Operator tuzatdi»,
   * o'zgargan maydon ostida — «Mijoz yozgani: «…». Tuzatish lid tarixiga yoziladi.» (DZ-12).
   */
  original?: AddressValue | null;
  editedBefore?: boolean;
  /** «Ko‘cha, uy» va «Xonadon, mo‘ljal» — eshikkacha yetkazishda. */
  withStreet?: boolean;
  /** Bo'sh majburiy maydon ostida xato (tasdiqlashga urinilganda). */
  showRequired?: boolean;
  /** Server xatolari (masalan, «Elchi u yerga yetkazmaydi»). */
  errors?: Partial<Record<AddressField, string>>;
  /** Kaskad va ko'cha maydonlari orasida. */
  children?: ReactNode;
  /** Zich forma (operator buyurtma formasi): maydon matni 15/22. */
  dense?: boolean;
}

/**
 * Manzil vidjeti (DZ-12, komponentlar-E §20): viloyat → tuman kaskadi `/regions/tree` dan (kalit SOATO),
 * ko'cha/uy (majburiy) va xonadon/mo'ljal (ixtiyoriy). Viloyat almashsa tuman tozalanadi; tuman viloyat
 * tanlanmaguncha yopiq. Operator formasi (FE-09) va admin buyurtma kartasi (FE-26) — shu bitta vidjet.
 */
const REQUIRED_TEXT = { region: 'address.regionRequired', district: 'address.districtRequired', street: 'address.streetRequired' } as const;

export function AddressFields({ value, onChange, original, editedBefore = false, withStreet = true, showRequired = false, errors: serverErrors, children, dense = false }: AddressFieldsProps) {
  const { t } = useTranslation();
  const missing = showRequired ? missingAddressFields(value, withStreet) : [];
  const errors: Partial<Record<AddressField, string>> = {
    ...Object.fromEntries(missing.map((field) => [field, t(REQUIRED_TEXT[field])])),
    ...serverErrors,
  };
  const id = useId();
  const tree = useRegionTree();
  const region = tree.data?.find((item) => item.satoCode === value.regionSoato);
  const districts = region?.districts ?? [];
  const failed = tree.isError && !tree.data;
  const edited = original ? editedBefore || addressChanged(value, original) : false;
  const ids = { title: `${id}-title`, region: `${id}-region`, district: `${id}-district`, street: `${id}-street`, apartment: `${id}-apartment` };
  const districtHelp = `${ids.district}-help`;

  // Mijoz yozgani — faqat operator o'zgartirgan maydon ostida (bo'sh qoldirganda ham).
  const nameOf = (regionSoato: string | null, districtSoato?: string | null) => {
    const group = tree.data?.find((item) => item.satoCode === regionSoato);
    return districtSoato === undefined ? group?.name : group?.districts.find((item) => item.satoCode === districtSoato)?.name;
  };
  const was = (text: string | null | undefined) => (text ? t('address.originalWas', { value: text }) : null);
  const originalOf = {
    region: original && value.regionSoato !== original.regionSoato ? was(nameOf(original.regionSoato)) : null,
    district: original && value.districtSoato !== original.districtSoato ? was(nameOf(original.regionSoato, original.districtSoato)) : null,
    street: original && value.street.trim() !== original.street.trim() ? was(original.street) : null,
  };
  const error = (field: AddressField, help: string) => (errors[field] ? (
    <p id={help} className={styles.error} role="alert">
      <CircleX aria-hidden />
      <span>{errors[field]}</span>
    </p>
  ) : null);
  const wasNote = (field: AddressField, help: string) => (originalOf[field] ? <p id={`${help}-was`} className={styles.hint}>{originalOf[field]}</p> : null);
  const describedByOf = (field: AddressField, help: string) => [errors[field] ? help : null, originalOf[field] ? `${help}-was` : null].filter(Boolean).join(' ') || undefined;

  const districtNote = failed ? (
    <p id={districtHelp} className={styles.error}>
      <CircleX aria-hidden />
      <span>{t('address.loadFailed')}</span>
    </p>
  ) : errors.district || originalOf.district ? (
    <>
      {error('district', districtHelp)}
      {wasNote('district', districtHelp)}
    </>
  ) : (
    <p id={districtHelp} className={styles.hint}>
      {tree.isPending ? t('address.loadingHint') : region ? t('address.soato') : t('address.districtHint')}
    </p>
  );

  return (
    <div className={styles.address} role="group" aria-labelledby={ids.title} data-dense={dense || undefined}>
      <div className={styles.head}>
        <h3 id={ids.title} className={styles.title}>{t('address.title')}</h3>
        {original ? (
          <span className={styles.chip} data-tone={edited ? 'warning' : undefined} data-testid="address-provenance">
            {edited ? t('address.editedByOperator') : t('address.fromCustomer')}
          </span>
        ) : null}
      </div>

      <div className={styles.cascade}>
        <div className={styles.field}>
          <Label htmlFor={ids.region} required>{t('address.region')}</Label>
          <SearchSelect
            id={ids.region}
            value={value.regionSoato}
            options={(tree.data ?? []).map((item) => ({ value: item.satoCode, label: item.name }))}
            searchable={false}
            required
            loading={tree.isPending}
            invalid={Boolean(errors.region)}
            describedBy={describedByOf('region', `${ids.region}-help`)}
            placeholder={tree.isPending ? t('address.loading') : t('address.regionPlaceholder')}
            label={t('address.region')}
            onChange={(regionSoato) => onChange({ ...value, regionSoato, districtSoato: regionSoato === value.regionSoato ? value.districtSoato : null })}
          />
          {error('region', `${ids.region}-help`)}
          {wasNote('region', `${ids.region}-help`)}
        </div>
        <div className={styles.field}>
          <Label htmlFor={ids.district} required>{t('address.district')}</Label>
          <SearchSelect
            id={ids.district}
            value={value.districtSoato}
            options={districts.map((item) => ({ value: item.satoCode, label: item.name }))}
            disabled={!region && !failed}
            required
            loading={tree.isPending}
            invalid={failed || Boolean(errors.district)}
            describedBy={failed ? districtHelp : describedByOf('district', districtHelp) ?? districtHelp}
            placeholder={tree.isPending ? t('address.loading') : t('address.districtPlaceholder')}
            label={t('address.district')}
            searchLabel={t('address.search')}
            listLabel={t('address.districts')}
            emptyText={(query) => t('address.searchEmpty', { query })}
            sheetHint={region?.name}
            onChange={(districtSoato) => onChange({ ...value, districtSoato })}
          />
          {districtNote}
        </div>
      </div>
      {failed ? (
        <button type="button" className={styles.retry} onClick={() => void tree.refetch()} disabled={tree.isFetching}>
          <RefreshCw aria-hidden />
          {t('address.retry')}
        </button>
      ) : null}

      {children}

      {withStreet ? (
        <div className={styles.street}>
          <div className={styles.field}>
            <Label htmlFor={ids.street} required>{t('address.street')}</Label>
            <input
              id={ids.street}
              className={styles.input}
              value={value.street}
              placeholder={t('address.streetPlaceholder')}
              autoComplete="street-address"
              aria-required
              aria-invalid={Boolean(errors.street) || undefined}
              aria-describedby={describedByOf('street', `${ids.street}-help`)}
              onChange={(event) => onChange({ ...value, street: event.target.value })}
            />
            {error('street', `${ids.street}-help`)}
            {wasNote('street', `${ids.street}-help`)}
          </div>
          <div className={styles.field}>
            <Label htmlFor={ids.apartment} note={t('address.optional')}>{t('address.apartment')}</Label>
            <input
              id={ids.apartment}
              className={styles.input}
              value={value.apartment}
              placeholder={t('address.apartmentPlaceholder')}
              onChange={(event) => onChange({ ...value, apartment: event.target.value })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Maydon nomi: majburiy — qizil «*», ixtiyoriy — o'ngda «ixtiyoriy». */
function Label({ htmlFor, required = false, note, children }: { htmlFor: string; required?: boolean; note?: string; children: string }) {
  return (
    <span className={styles.labelRow}>
      <label htmlFor={htmlFor} className={styles.label}>
        {children}
        {required ? <span className={styles.required} aria-hidden>*</span> : null}
      </label>
      {note ? <span className={styles.note}>{note}</span> : null}
    </span>
  );
}
