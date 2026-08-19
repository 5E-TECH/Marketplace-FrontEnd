import { Input, InputNumber, Select } from 'antd';
import type { InputNumberProps, InputProps } from 'antd';
import type { TextAreaProps } from 'antd/es/input';
import type { ReactNode } from 'react';
import styles from './FormControls.module.css';

export function TextControl({ className, ...props }: InputProps) {
  return <Input {...props} className={`${styles.control} ${className ?? ''}`} />;
}

export function TextAreaControl({ className, ...props }: TextAreaProps) {
  return (
    <Input.TextArea
      {...props}
      className={`${styles.control} ${styles.textAreaControl} ${className ?? ''}`}
    />
  );
}

export function NumberControl({
  className,
  onFocus,
  ...props
}: InputNumberProps<number>) {
  return (
    <InputNumber<number>
      {...props}
      className={`${styles.control} ${styles.numberControl} ${className ?? ''}`}
      controls={false}
      onFocus={(event) => {
        event.target.select();
        onFocus?.(event);
      }}
    />
  );
}

export interface SelectControlOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface SelectControlProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  options: SelectControlOption[];
  onChange?: (value: string) => void;
}

export function SelectControl({ options, ...props }: SelectControlProps) {
  return (
    <Select
      {...props}
      className={`${styles.control} ${styles.selectControl}`}
      options={options}
      optionRender={(option) => {
        const item = options.find(({ value }) => value === option.value);
        return (
          <div className={styles.option}>
            {item?.icon ? <span className={styles.optionIcon}>{item.icon}</span> : null}
            <span className={styles.optionCopy}>
              <strong>{item?.label ?? option.label}</strong>
              {item?.description ? <small>{item.description}</small> : null}
            </span>
          </div>
        );
      }}
      labelRender={({ value, label }) => {
        const item = options.find((option) => option.value === value);
        return (
          <span className={styles.selectedOption}>
            {item?.icon}
            <span>{label}</span>
          </span>
        );
      }}
    />
  );
}
