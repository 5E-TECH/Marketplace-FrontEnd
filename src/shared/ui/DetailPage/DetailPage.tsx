import { Avatar } from 'antd';
import type { ReactNode } from 'react';
import { BackButton } from '../BackButton/BackButton';
import { PageHeader } from '../PageHeader/PageHeader';
import styles from './DetailPage.module.css';

export interface DetailPageField {
  key: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

export interface DetailPageSection {
  key: string;
  icon: ReactNode;
  title: string;
  description?: string;
  fields: readonly DetailPageField[];
}

interface DetailPageProps {
  backFallback: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  hero: {
    avatarUrl?: string | null;
    avatarShape?: 'circle' | 'square';
    avatarFallback: string;
    title: string;
    subtitle?: string;
    badges?: ReactNode;
  };
  sections: readonly DetailPageSection[];
  children?: ReactNode;
}

export function DetailPage({
  backFallback,
  title,
  description,
  actions,
  hero,
  sections,
  children,
}: DetailPageProps) {
  return (
    <main className={styles.page}>
      <PageHeader
        before={<BackButton fallback={backFallback} />}
        title={title}
        description={description}
        extra={actions}
      />
      <div className={styles.content}>
        <section className={styles.hero}>
          <Avatar className={styles.avatar} shape={hero.avatarShape} size={76} src={hero.avatarUrl}>
            {hero.avatarFallback}
          </Avatar>
          <div className={styles.identity}>
            <h2>{hero.title}</h2>
            {hero.subtitle ? <p>{hero.subtitle}</p> : null}
            {hero.badges ? <div className={styles.badges}>{hero.badges}</div> : null}
          </div>
        </section>

        {sections.map((section) => (
          <section className={styles.card} key={section.key}>
            <div className={styles.cardHeading}>
              {section.icon}
              <div>
                <h3>{section.title}</h3>
                {section.description ? <p>{section.description}</p> : null}
              </div>
            </div>
            <dl className={styles.detailGrid}>
              {section.fields.map((field) => (
                <div className={styles.detailItem} key={field.key}>
                  <span className={styles.detailIcon}>{field.icon}</span>
                  <div><dt>{field.label}</dt><dd>{field.value}</dd></div>
                </div>
              ))}
            </dl>
          </section>
        ))}
        {children}
      </div>
    </main>
  );
}
