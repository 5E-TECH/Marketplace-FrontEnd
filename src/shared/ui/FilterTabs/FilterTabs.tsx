import styles from './FilterTabs.module.css';

export interface FilterTabOption<Value extends string> {
  value: Value;
  label: string;
}

interface FilterTabsProps<Value extends string> {
  value: Value;
  options: readonly FilterTabOption<Value>[];
  ariaLabel?: string;
  onChange: (value: Value) => void;
}

export function FilterTabs<Value extends string>({
  value,
  options,
  ariaLabel = 'Filterlar',
  onChange,
}: FilterTabsProps<Value>) {
  return (
    <nav className={styles.tabs} aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? styles.active : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </nav>
  );
}
