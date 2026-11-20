import { CircleX, PencilLine, RefreshCw, UserRound } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Badge } from '../../../shared/ui/Badge/Badge';
import { SearchSelect } from '../../../shared/ui/SearchSelect/SearchSelect';
import { useRegionTree } from '../api/regionsQueries';
import { addressChanged, missingAddressFields, type AddressField, type AddressValue } from '../lib/addressValue';
import styles from './AddressFields.module.css';

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  /**
   * Mijoz yozgan manzil (lid formasidan). Berilsa sarlavha yonida belgi: «Mijoz yozgan»;
   * operator maydonni o'zgartirsa (yoki oldin tuzatgan bo'lsa — `editedBefore`) «Operator tuzatdi».
   */
  original?: AddressValue | null;
  editedBefore?: boolean;
  /** «Ko‘cha, uy» va «Xonadon, mo‘ljal» — eshikkacha yetkazishda. */
  withStreet?: boolean;
  /** Bo'sh majburiy maydon ostida xato (tasdiqlashga urinilganda). */
  showRequired?: boolean;
  /** Server xatolari (masalan, «Elchi u yerga yetkazmaydi»). */
  errors?: Partial<Record<AddressField, string>>;
  /** Kaskad va ko'cha maydonlari orasida (operator formasida — «Yetkazish» tanlovi). */
  children?: ReactNode;
}

/**
 * Manzil vidjeti (DZ-12, komponentlar-E §20): viloyat → tuman kaskadi `/regions/tree` dan (kalit SOATO),
 * ko'cha/uy (majburiy) va xonadon/mo'ljal (ixtiyoriy). Viloyat almashsa tuman tozalanadi; tuman viloyat
 * tanlanmaguncha yopiq. Operator formasi (FE-09) va admin buyurtma kartasi (FE-26) — shu bitta vidjet.
 */
const REQUIRED_TEXT = { region: 'address.regionRequired', district: 'address.districtRequired', street: 'address.streetRequired' } as const;

export function AddressFields({ value, onChange, original, editedBefore = false, withStreet = true, showRequired = false, errors: serverErrors, children }: AddressFieldsProps) {
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

  const districtNote = failed ? (
    <p id={districtHelp} className={styles.error}>
      <CircleX aria-hidden />
      <span>{t('address.loadFailed')}</span>
    </p>
  ) : errors.district ? (
    <p id={districtHelp} className={styles.error} role="alert">
      <CircleX aria-hidden />
      <span>{errors.district}</span>
    </p>
  ) : (
    <p id={districtHelp} className={styles.hint}>
      {tree.isPending ? t('address.loadingHint') : region ? t('address.soato') : t('address.districtHint')}
    </p>
  );

  return (
    <div className={styles.address} role="group" aria-labelledby={ids.title}>
      <div className={styles.head}>
        <h3 id={ids.title} className={styles.title}>{t('address.title')}</h3>
        {original ? (
          <Badge tone={edited ? 'info' : 'neutral'} icon={edited ? PencilLine : UserRound} testId="address-provenance">
            {edited ? t('address.editedByOperator') : t('address.fromCustomer')}
          </Badge>
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
            describedBy={errors.region ? `${ids.region}-help` : undefined}
            placeholder={tree.isPending ? t('address.loading') : t('address.regionPlaceholder')}
            label={t('address.region')}
            onChange={(regionSoato) => onChange({ ...value, regionSoato, districtSoato: regionSoato === value.regionSoato ? value.districtSoato : null })}
          />
          {errors.region ? (
            <p id={`${ids.region}-help`} className={styles.error} role="alert">
              <CircleX aria-hidden />
              <span>{errors.region}</span>
            </p>
          ) : null}
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
            describedBy={districtHelp}
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
              aria-describedby={errors.street ? `${ids.street}-help` : undefined}
              onChange={(event) => onChange({ ...value, street: event.target.value })}
            />
            {errors.street ? (
              <p id={`${ids.street}-help`} className={styles.error} role="alert">
                <CircleX aria-hidden />
                <span>{errors.street}</span>
              </p>
            ) : null}
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
