import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Chart.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Bo'lsa — faqat ikonka, nom `aria-label` va `title` da. */
  icon?: ReactNode;
}

interface ChartSegmentProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Ikonka yonida nom ham («Kartalar», «Jadval» — sotuvchi-offerlar). */
  showLabels?: boolean;
}

const ARROW_STEP: Readonly<Record<string, number | undefined>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Radio guruh (komponentlar-E §23): bitta Tab to'xtashi, strelkalar bilan almashadi. */
export function ChartSegment<T extends string>({ label, options, value, onChange, showLabels = false }: ChartSegmentProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = ARROW_STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={styles.segment} data-variant={!options[0]?.icon ? 'text' : showLabels ? 'labelled' : undefined}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.icon && !showLabels ? option.label : undefined}
          title={option.icon && !showLabels ? option.label : undefined}
          tabIndex={value === option.value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.icon && showLabels ? <>{option.icon}{option.label}</> : option.icon ?? option.label}
        </button>
      ))}
    </div>
  );
}
