import { App } from 'antd';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './CopyButton.module.css';

interface CopyButtonProps {
  text: string;
  /** Berilsa — matnli tugma («Nusxa olish»); aks holda faqat ikonka. */
  label?: string;
  /** Ikonka tugmasining nomi: «Xato raqamini nusxalash». */
  ariaLabel?: string;
  /** Muvaffaqiyat xabari (sukut — «Nusxa olindi»). */
  successMessage?: string;
  size?: 'sm' | 'md';
}

const COPIED_MS = 1500;

/** Nusxa tugmasi: bosilganda matn buferga, belgi bir lahza «✓» ga o'zgaradi va xabar chiqadi. */
export function CopyButton({ text, label, ariaLabel, successMessage, size = 'md' }: CopyButtonProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
        void message.success(successMessage ?? t('copy.done'));
      },
      () => void message.error(t('copy.failed')),
    );
  };
  const Icon = copied ? Check : Copy;

  if (label) {
    return (
      <button type="button" className={styles.button} data-copied={copied || undefined} onClick={copy}>
        <Icon aria-hidden />
        {label}
      </button>
    );
  }
  const name = ariaLabel ?? t('copy.copy');
  return (
    <button type="button" className={styles.icon} data-size={size} data-copied={copied || undefined} aria-label={name} title={name} onClick={copy}>
      <Icon aria-hidden />
    </button>
  );
}
