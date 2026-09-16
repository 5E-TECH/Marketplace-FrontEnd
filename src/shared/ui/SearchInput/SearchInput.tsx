import { Input, type InputProps } from 'antd';
import { Search } from 'lucide-react';
import styles from './SearchInput.module.css';

interface SearchInputProps extends Omit<InputProps, 'onChange' | 'prefix'> {
  onValueChange: (value: string) => void;
}

export function SearchInput({ className, onValueChange, ...props }: SearchInputProps) {
  return (
    <Input
      {...props}
      className={`${styles.input} ${className ?? ''}`.trim()}
      allowClear={props.allowClear ?? true}
      prefix={<Search className={styles.icon} size={16} strokeWidth={1.8} aria-hidden />}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}
