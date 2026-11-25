import { useId, type ReactNode } from 'react';
import styles from './RecordCard.module.css';

/** Bo'lim: sarlavha, izoh, o'ngda havola (telefonda — pastda, to'liq kenglikda). Lid va buyurtma kartalari. */
export function Section({ title, description, link, phone, children, id }: { title: string; description?: string; link?: ReactNode; phone: boolean; children: ReactNode; id?: string }) {
  const headingId = useId();
  return (
    <section className={styles.section} aria-labelledby={headingId} id={id}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id={headingId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {link && !phone ? link : null}
      </div>
      {children}
      {link && phone ? <div className={styles.sectionFoot}>{link}</div> : null}
    </section>
  );
}

export interface Fact {
  label: string;
  value: ReactNode;
  notes?: ReactNode[];
}

/**
 * Ma'lumot ro'yxati: chapda nom (110–170 px), o'ngda qiymat va izohlar; telefonda ustma-ust
 * (`pairs` — telefonda ikki ustun: sub1 · sub2–sub5, utm · fbclid).
 */
export function Facts({ rows, width = 150, pairs = false }: { rows: readonly Fact[]; width?: 110 | 120 | 140 | 150 | 160 | 170; pairs?: boolean }) {
  return (
    <dl className={styles.facts} data-width={width} data-pairs={pairs || undefined}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>
            {row.value}
            {row.notes?.filter(Boolean).map((note, index) => <span key={index} className={styles.factNote}>{note}</span>)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Kulrang izoh qatori belgi bilan. */
export const Hint = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => <p className={styles.hint}>{icon}<span>{children}</span></p>;
