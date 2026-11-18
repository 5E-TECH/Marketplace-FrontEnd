import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import styles from './LoginMethods.module.css';

const METHODS: ReadonlyArray<{ title: TranslationKey; text: TranslationKey; note: TranslationKey; staff: boolean }> = [
  { title: 'login.methodSeller', text: 'login.methodSellerText', note: 'login.methodSellerNote', staff: false },
  { title: 'login.methodStaff', text: 'login.methodStaffText', note: 'login.methodStaffNote', staff: true },
  { title: 'login.methodAdmin', text: 'login.methodAdminText', note: 'login.methodAdminNote', staff: true },
];

interface LoginMethodsProps {
  /** `navy` — desktop chap blok; `light` — telefonda forma ostida, izohsiz. */
  tone: 'navy' | 'light';
  brand?: React.ReactNode;
  /** Tanlangan kirish usuli: sotuvchi — 1-qator, xodim — 2- va 3-qator faol. */
  active: 'seller' | 'staff';
}

/** «Kirish usuli rolingizga bog'liq» (umumiy-kirish): tanlangan usul qatori ajralib turadi. */
export function LoginMethods({ tone, brand, active }: LoginMethodsProps) {
  const { t } = useTranslation();
  return (
    <aside className={tone === 'navy' ? styles.navy : styles.light} aria-labelledby="login-methods">
      {brand}
      <div className={styles.body}>
        <h2 id="login-methods" className={styles.title}>{t('login.methodsTitle')}</h2>
        <dl className={styles.list}>
          {METHODS.map((method) => (
            <div key={method.title} className={styles.method} aria-current={method.staff === (active === 'staff') ? 'true' : undefined}>
              <dt>{t(method.title)}</dt>
              <dd>{t(method.text)}</dd>
              {tone === 'navy' ? <dd className={styles.note}>{t(method.note)}</dd> : null}
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
