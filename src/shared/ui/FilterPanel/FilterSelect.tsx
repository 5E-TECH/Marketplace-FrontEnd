import { Select, type SelectProps } from 'antd';
import styles from './FilterPanel.module.css';

export function FilterSelect<ValueType = unknown>({ className = '', ...props }: SelectProps<ValueType>) {
  return (
    <Select<ValueType>
      {...props}
      className={`${styles.select} ${className}`.trim()}
      optionFilterProp={props.optionFilterProp ?? 'label'}
    />
  );
}
