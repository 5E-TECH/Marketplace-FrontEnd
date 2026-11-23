import { CircleCheck, CircleX, Info, Search, TriangleAlert } from 'lucide-react';
import { forwardRef, useId, type ReactNode } from 'react';
import { DUPLICATE_WINDOW_MS } from '../../../features/inbound/lib/scanRules';
import type { ScanMode } from '../../../features/inbound/model/inboundTypes';
import type { ScanProblem } from '../../../features/inbound/model/useReceiving';
import { ScanField, type ScanFieldHandle } from '../../../features/warehouse/ui/ScanField';
import { ScannerStatus } from '../../../features/warehouse/ui/WarehouseTopStatus';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from '../WarehouseInboundPage.module.css';

interface ScanCardProps {
  phone: boolean;
  onScan: (code: string) => void;
  /** Qabul ochiq: «Keyingi skan» (Qabul / Brak) va qabul matni; yo'q — ro'yxat ko'rinishi. */
  mode?: ScanMode;
  onModeChange?: (mode: ScanMode) => void;
  problem?: ScanProblem | null;
  onProblemClear?: () => void;
  /** Takroriy skan kodi — «bitta hisoblandi» bloki. */
  duplicate?: string | null;
  accepted?: number;
  onFindByName?: () => void;
  /** Ro'yxat ko'rinishidagi xabar (bir nechta mos postavka, arizasiz mahsulot). */
  message?: ReactNode;
}

/** «Shtrix-kod» bloki (ombor-qabul 1, holatlar 2): skaner maydoni doim faol, Enter — qabul. */
export const ScanCard = forwardRef<ScanFieldHandle, ScanCardProps>(function ScanCard(
  { phone, onScan, mode, onModeChange, problem = null, onProblemClear, duplicate = null, accepted = 0, onFindByName, message },
  ref,
) {
  const { t } = useTranslation();
  const noticeId = useId();
  const receiving = mode !== undefined;

  return (
    <section className={`${styles.card} ${styles.scan}`} aria-label={t('inb.recv.barcode')} data-testid="scan-card">
      <div className={styles.scanRow}>
        <ScanField
          ref={ref}
          label={t('inb.recv.barcode')}
          labelExtra={phone ? <ScannerStatus /> : undefined}
          placeholder={t(receiving ? 'inb.recv.placeholder' : 'inb.recv.placeholderFirst')}
          onScan={onScan}
          invalidCode={problem?.code ?? null}
          onInvalidClear={onProblemClear}
          describedBy={problem ? noticeId : undefined}
        />
        {receiving && onModeChange ? (
          <div className={styles.modeField}>
            <span className={styles.modeLabel} id={`${noticeId}-mode`}>{t('inb.recv.nextScan')}</span>
            <div className={styles.modes} role="radiogroup" aria-labelledby={`${noticeId}-mode`}>
              {(['ACCEPT', 'DEFECT'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  className={styles.mode}
                  data-kind={value === 'ACCEPT' ? 'accept' : 'defect'}
                  aria-checked={mode === value}
                  // Skaner maydonidan fokus ketmasin: tugma bosilganda ham kod maydonga yoziladi.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onModeChange(value)}
                >
                  {value === 'ACCEPT' ? <CircleCheck aria-hidden /> : <CircleX aria-hidden />}
                  {t(value === 'ACCEPT' ? 'inb.recv.accept' : 'inb.recv.defect')}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {problem ? (
        <div className={styles.notice} data-tone="warning" id={noticeId} role="alert" data-testid="scan-problem">
          <div className={styles.noticeBody}>
            <TriangleAlert aria-hidden />
            <p>
              <strong>{t(problem.kind === 'UNKNOWN' ? 'inb.recv.unknownTitle' : 'inb.recv.foreignTitle')}</strong>
              {problem.kind === 'UNKNOWN'
                ? <>{t('inb.recv.unknownText', { code: problem.code, count: accepted })} <span className={styles.muted}>{t('inb.recv.tbd')}</span>.</>
                : t('inb.recv.foreignText', { code: problem.code, product: problem.productName ?? '', number: problem.otherShipment ?? '', count: accepted })}
            </p>
          </div>
          {problem.kind === 'UNKNOWN' && onFindByName ? (
            <button type="button" className={styles.secondary} onClick={onFindByName}><Search aria-hidden />{t('inb.recv.findByName')}</button>
          ) : null}
        </div>
      ) : null}
      {duplicate && !problem ? (
        <div className={styles.notice} data-tone="info" role="status" data-testid="scan-duplicate">
          <div className={styles.noticeBody}>
            <Info aria-hidden />
            <p>
              <strong>{t('inb.recv.duplicateTitle')}</strong>
              {t('inb.recv.duplicateText', { code: duplicate, count: accepted, seconds: DUPLICATE_WINDOW_MS / 1000 })}
            </p>
          </div>
        </div>
      ) : null}
      {message}
      <p className={styles.hint}>{t(receiving ? 'inb.recv.hint' : 'inb.recv.hintFirst')}</p>
    </section>
  );
});
