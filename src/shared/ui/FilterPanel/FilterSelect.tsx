import { Select, type SelectProps } from 'antd';
import styles from './FilterPanel.module.css';

export function FilterSelect<ValueType = unknown>({ className = '', showSearch, ...props }: SelectProps<ValueType>) {
  // Qidiruv yoqilgan bo'lsa (multiple/tags'da antd uni o'zi yoqadi) option'lar
  // ichki value emas, ko'rinadigan nomi (label) bo'yicha filtrlanadi.
  const searchEnabled = showSearch ?? (props.mode === 'multiple' || props.mode === 'tags');
  return (
    <Select<ValueType>
      {...props}
      className={`${styles.select} ${className}`.trim()}
      showSearch={searchEnabled ? { optionFilterProp: 'label', ...(typeof showSearch === 'object' ? showSearch : {}) } : showSearch}
    />
  );
}
