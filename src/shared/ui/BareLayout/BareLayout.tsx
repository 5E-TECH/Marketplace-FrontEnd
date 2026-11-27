import type { ReactNode } from 'react';
import { BRAND } from '../../config/brand';
import { LanguageSwitcher } from '../LanguageSwitcher/LanguageSwitcher';
import styles from './BareLayout.module.css';

const BRAND_ICON = '/brand/elchi-app-icon.png';

interface BareLayoutProps {
  icon: ReactNode;
  /** Ikonka doirasi: `danger` — bloklandi, `action` — rol o'zgardi. */
  tone: 'danger' | 'action';
  title: string;
  lead: ReactNode;
  /** Tugmalar — chiziq ustida o'ngda; telefonda to'liq kenglikda ustma-ust. */
  actions: ReactNode;
  children: ReactNode;
  testId?: string;
}

/**
 * Karkassiz sahifa (umumiy-sessiya 7–9, karkas-E 4.2): menyusiz — tepada brend va til, markazda 600 px karta.
 * Sessiya yo'q yoki panel hali ochilmaydi: «Hisobingiz bloklangan», «Rolingiz o‘zgardi».
 */
export function BareLayout({ icon, tone, title, lead, actions, children, testId }: BareLayoutProps) {
  return (
    <div className={styles.page} data-testid={testId}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <img src={BRAND_ICON} alt="" width={32} height={32} />
          <span>{BRAND.name}</span>
        </span>
        <LanguageSwitcher className={styles.language} />
      </header>
      <div className={styles.body}>
        <main className={styles.card} aria-labelledby="bare-title">
          <div className={styles.head}>
            <span className={styles.icon} data-tone={tone} aria-hidden>{icon}</span>
            <div className={styles.headText}>
              <h1 id="bare-title">{title}</h1>
              <p>{lead}</p>
            </div>
          </div>
          {children}
          <div className={styles.actions}>{actions}</div>
        </main>
      </div>
    </div>
  );
}

/** Kalit-qiymat ro'yxati: desktopda yorliq 170 px chapda, telefonda ustma-ust (umumiy-sessiya Izoh). */
export function BareFacts({ items, label }: { items: { key: string; label: string; value: ReactNode }[]; label?: string }) {
  return (
    <dl className={styles.facts} aria-label={label}>
      {items.map((item) => (
        <div key={item.key}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Chiziq ustidagi bo'lim: qalin sarlavha va mazmun («Pul», «Sahifalaringiz», «Qarorga e’tiroz»). */
export function BareSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <p className={styles.sectionTitle}>{title}</p>
      {children}
    </section>
  );
}

/** Ikonka matndan oldin («Chiqish», «Ofertani o‘qish»); `iconEnd` — keyin («Ish joyini ochish →»). */
export function BareButton({ primary = false, icon, iconEnd, onClick, children }: { primary?: boolean; icon?: ReactNode; iconEnd?: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`${styles.button} ${primary ? styles.primary : styles.secondary}`} onClick={onClick}>
      {icon}
      {children}
      {iconEnd}
    </button>
  );
}

export function BareText({ children }: { children: ReactNode }) {
  return <p className={styles.text}>{children}</p>;
}

/** Backend hali bermagan qiymat — kulrang `[sana]`, `[murojaat kanali — TZ’da yo‘q]`. */
export function BarePending({ children }: { children: ReactNode }) {
  return <span className={styles.pending}>{children}</span>;
}
