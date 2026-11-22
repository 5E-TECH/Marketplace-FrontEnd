import { ScanBarcode } from 'lucide-react';
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { normalizeBarcode } from '../../inbound/lib/scanRules';
import { registerScanField, setScanFieldFocused } from '../lib/scannerPresence';
import styles from './ScanField.module.css';

export interface ScanFieldHandle {
  focus: () => void;
}

interface ScanFieldProps {
  label: ReactNode;
  placeholder: string;
  /** Enter (yoki skaner yuborgan Tab) — kod tozalab beriladi. */
  onScan: (code: string) => void;
  /** Noma'lum kod: maydon qizil, kod ko'rinib turadi — keyingi yozuvgacha. */
  invalidCode?: string | null;
  /** Noma'lum kod ko'rinib turganda yangi belgi yozildi — sahifa ogohlantirishni yopadi. */
  onInvalidClear?: () => void;
  /** Ogohlantirish bloki (`aria-describedby`). */
  describedBy?: string;
  /** Label qatorining o'ng tomoni (telefonda «● Skaner: tayyor»). */
  labelExtra?: ReactNode;
  disabled?: boolean;
  testId?: string;
}

/** Oyna ochiq bo'lsa fokus olinmaydi: omborchi oynadagi maydonga yozayotgan bo'lishi mumkin. */
const dialogOpen = () => Boolean(document.querySelector('.ant-modal-wrap:not([style*="display: none"])'));

/**
 * Skan maydoni (ombor-qabul, karkas-E 4.7): klaviatura emulyatsiyali skaner kodni yozib Enter bosadi.
 * Maydon doim faol — fokus «hech qayerga» (body) tushsa, o'zi qaytadi; boshqa maydonga o'tilsa, yuqori
 * qatorda «Skaner: maydonga bosing». `inputmode="none"` — planshetda ekran klaviaturasi chiqmaydi.
 */
export const ScanField = forwardRef<ScanFieldHandle, ScanFieldProps>(function ScanField(
  { label, placeholder, onScan, invalidCode = null, onInvalidClear, describedBy, labelExtra, disabled = false, testId = 'scan-field' },
  ref,
) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const showingInvalid = invalidCode !== null && value === '';

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  useEffect(() => registerScanField(), []);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
    // Allaqachon fokusdagi maydonga `focus()` hodisa bermaydi (StrictMode qayta o'rnatishi) — holat qo'lda.
    setScanFieldFocused(document.activeElement === inputRef.current);
    // Fokus body ga tushsa (oyna yopildi, tugma yo'qoldi) — maydonga qaytadi.
    const onFocusOut = () => window.setTimeout(() => {
      if (disabled || dialogOpen()) return;
      const active = document.activeElement;
      if (!active || active === document.body) inputRef.current?.focus();
    }, 0);
    document.addEventListener('focusout', onFocusOut);
    return () => document.removeEventListener('focusout', onFocusOut);
  }, [disabled]);

  const submit = () => {
    const code = normalizeBarcode(value);
    setValue('');
    if (code) onScan(code);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || (event.key === 'Tab' && value)) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>{label}</label>
        {labelExtra}
      </div>
      <div className={styles.control}>
        <ScanBarcode className={styles.icon} aria-hidden />
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="none"
          autoComplete="off"
          spellCheck={false}
          className={styles.input}
          placeholder={placeholder}
          value={showingInvalid ? invalidCode : value}
          aria-invalid={invalidCode !== null}
          aria-describedby={describedBy}
          disabled={disabled}
          data-testid={testId}
          onChange={(event) => {
            const next = event.target.value;
            if (invalidCode !== null) {
              onInvalidClear?.();
              // Noma'lum kod ko'rinib turgan edi: yangi skan undan keyin yozilgan belgilardan boshlanadi.
              setValue(showingInvalid && next.startsWith(invalidCode) ? next.slice(invalidCode.length) : next);
              return;
            }
            setValue(next);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setScanFieldFocused(true)}
          onBlur={() => setScanFieldFocused(false)}
        />
      </div>
    </div>
  );
});
