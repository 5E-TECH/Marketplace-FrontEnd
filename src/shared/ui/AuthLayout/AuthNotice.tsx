import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './authForm.module.css';

const ICONS = { warning: TriangleAlert, danger: CircleAlert, info: Info, success: CircleCheck } as const;

interface AuthNoticeProps {
  /** warning — kechikish/429; danger — xato yoki blok; info — «hisob bor»; success — «yangi kod yuborildi». */
  tone: keyof typeof ICONS;
  title: string;
  text?: ReactNode;
  /** Blok ichidagi tugmalar («Ro‘yxatdan o‘tish»). */
  children?: ReactNode;
}

/** Kirish va ro'yxat formalaridagi holat bloki (umumiy-kirish, sotuvchi-royxat). */
export function AuthNotice({ tone, title, text, children }: AuthNoticeProps) {
  const Icon = ICONS[tone];
  return (
    <div className={styles[tone]} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon aria-hidden />
      <div className={styles.noticeBody}>
        <p className={styles.noticeTitle}>{title}</p>
        {text ? <p className={styles.noticeText}>{text}</p> : null}
        {children ? <div className={styles.noticeActions}>{children}</div> : null}
      </div>
    </div>
  );
}
