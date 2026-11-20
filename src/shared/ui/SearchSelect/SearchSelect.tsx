import { Popover } from 'antd';
import { Check, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { SheetModal } from '../SheetModal/SheetModal';
import styles from './SearchSelect.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchSelectProps {
  id: string;
  value: string | null;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  /** Ro'yxat yuklanmoqda: `disabled` + `aria-busy`, strelka o'rnida spinner. */
  loading?: boolean;
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
  /** Qidiruvli ro'yxat; sukut — 7 tadan ko'p band (komponentlar-E §20). */
  searchable?: boolean;
  /** Telefonda varaq sarlavhasi va ro'yxat nomi — maydon nomi; izoh — masalan, tanlangan viloyat. */
  label: string;
  /** Qidiruv: «Tuman qidirish»; ro'yxat: «Tumanlar»; bo'sh natija: «“…” bo‘yicha tuman yo‘q». */
  searchLabel?: string;
  listLabel?: string;
  emptyText?: (query: string) => string;
  sheetHint?: string;
}

/** Qidiruvda harf va tutuq belgisi farqi hisobga olinmaydi: «qo'qon» = «Qo‘qon». */
const normalize = (text: string) => text.toLocaleLowerCase('uz').replace(/[‘’ʻʼ`']/g, "'");
const SEARCHABLE_FROM = 8;

/**
 * Tanlov maydoni (komponentlar-E §20): 7 tagacha band — oddiy `select`; ko'prog'i — qidiruvli combobox:
 * desktop va planshetda ochiluvchi ro'yxat (band 36), telefonda pastdan varaq (band 44). Joriy band —
 * `aria-selected`, och ko'k fon va belgi; strelkalar bilan yuriladi, Enter tanlaydi, Esc yopadi.
 */
export function SearchSelect(props: SearchSelectProps) {
  const { id, value, options, onChange, placeholder, disabled = false, loading = false, invalid = false, required = false, describedBy } = props;
  const searchable = props.searchable ?? options.length >= SEARCHABLE_FROM;
  const selected = options.find((option) => option.value === value);
  const locked = disabled || loading;

  if (!searchable) {
    return (
      <div className={styles.wrap}>
        <select
          id={id}
          className={styles.control}
          value={selected ? selected.value : ''}
          disabled={locked}
          aria-busy={loading || undefined}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          data-empty={selected ? undefined : true}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {loading ? <span className={styles.spinner} aria-hidden /> : <ChevronDown className={styles.chevron} aria-hidden />}
      </div>
    );
  }
  return <Combobox {...props} selected={selected} locked={locked} />;
}

function Combobox({
  id, options, onChange, placeholder, loading = false, invalid = false, required = false, describedBy, label, sheetHint, selected, locked, ...texts
}: SearchSelectProps & { selected: SelectOption | undefined; locked: boolean }) {
  const { t } = useTranslation();
  const searchLabel = texts.searchLabel ?? t('select.search');
  const emptyText = texts.emptyText ?? ((query: string) => t('select.searchEmpty', { query }));
  const phone = useMediaQuery('(max-width: 767.98px)');
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  /** Ro'yxat joyiga o'rnashgach fokus qidiruvga — sahifa siljimaydi. */
  const focusSearch = (visible: boolean) => {
    if (visible) search.current?.focus({ preventScroll: true });
  };
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [width, setWidth] = useState<number>();
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const found = options.filter((option) => words.every((word) => normalize(option.label).includes(word)));

  /** `refocus` — tanlanganda yoki Esc da fokus maydonga qaytadi (tashqariga bosilganda emas). */
  const show = (next: boolean, refocus = false) => {
    setOpen(next);
    setQuery('');
    setActive(Math.max(0, options.findIndex((option) => option.value === selected?.value)));
    if (next) setWidth(trigger.current?.offsetWidth);
    if (refocus) trigger.current?.focus();
  };
  const choose = (option: SelectOption) => {
    onChange(option.value);
    show(false, true);
  };
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (found.length ? (index + step + found.length) % found.length : 0));
    } else if (event.key === 'Enter' && found[active]) {
      event.preventDefault();
      choose(found[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      show(false, true);
    }
  };
  const optionId = (index: number) => `${listId}-${index}`;

  const panel = (
    <div className={styles.panel} data-sheet={phone || undefined}>
      <div className={styles.search}>
        <Search aria-hidden />
        <input
          ref={search}
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          aria-controls={listId}
          aria-activedescendant={found[active] ? optionId(active) : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onSearchKey}
        />
      </div>
      {found.length ? (
        <ul id={listId} role="listbox" aria-label={texts.listLabel ?? label} className={styles.list}>
          {found.map((option, index) => {
            const current = option.value === selected?.value;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={current}
                data-active={index === active || undefined}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {current ? <Check aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div role="status" className={styles.empty}>
          <strong>{emptyText(query.trim())}</strong>
          <span>{t('select.searchEmptyHint')}</span>
        </div>
      )}
    </div>
  );

  const button = (
    <button
      ref={trigger}
      id={id}
      type="button"
      role="combobox"
      className={styles.control}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-busy={loading || undefined}
      aria-invalid={invalid || undefined}
      aria-required={required || undefined}
      aria-describedby={describedBy}
      data-empty={selected ? undefined : true}
      disabled={locked}
      onClick={phone ? () => show(!open) : undefined}
      onKeyDown={(event) => {
        if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          show(true);
        }
      }}
    >
      <span className={styles.value}>{selected?.label ?? placeholder}</span>
      {loading ? <span className={styles.spinner} aria-hidden /> : open && !phone ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
    </button>
  );

  if (phone) {
    return (
      <>
        {button}
        <SheetModal
          open={open}
          footer={null}
          destroyOnHidden
          afterOpenChange={focusSearch}
          title={
            <span className={styles.sheetHead}>
              <span>{label}</span>
              {sheetHint ? <span className={styles.sheetHint}>{sheetHint}</span> : null}
            </span>
          }
          onCancel={() => show(false, true)}
        >
          {panel}
        </SheetModal>
      </>
    );
  }
  return (
    <Popover
      open={open}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      destroyOnHidden
      rootClassName={styles.popover}
      afterOpenChange={focusSearch}
      content={<div style={{ width }}>{panel}</div>}
      onOpenChange={(next) => show(next)}
    >
      {button}
    </Popover>
  );
}
