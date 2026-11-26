import type { ReactNode } from 'react';
import type { TranslationKey } from '../../../../shared/i18n/translations';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import styles from './LoginMethods.module.css';

type Active = 'seller' | 'staff' | 'admin';
type Tone = 'navy' | 'light';
type SetupStep = 'app' | 'codes';
interface AsideItem { title: TranslationKey; text: TranslationKey; note: TranslationKey }

/** Qaysi tanlovda qator faol: sotuvchi — 1-qator, xodim — 2- va 3-qator, 2FA bosqichi — faqat 3-qator (umumiy-2fa). */
const METHODS: ReadonlyArray<AsideItem & { activeFor: readonly Active[] }> = [
  { title: 'login.methodSeller', text: 'login.methodSellerText', note: 'login.methodSellerNote', activeFor: ['seller'] },
  { title: 'login.methodStaff', text: 'login.methodStaffText', note: 'login.methodStaffNote', activeFor: ['staff'] },
  { title: 'login.methodAdmin', text: 'login.methodAdminText', note: 'login.methodAdminNote', activeFor: ['staff', 'admin'] },
];

/** «Ikkinchi kodni ulash» (umumiy-2fa-ulash): ulash paytida 1-qadam, zaxira kodlarda 2-qadam faol. */
const SETUP_STEPS: ReadonlyArray<AsideItem & { step: SetupStep }> = [
  { title: 'tfa.asideApp', text: 'tfa.asideAppText', note: 'tfa.asideAppNote', step: 'app' },
  { title: 'tfa.asideCodes', text: 'tfa.asideCodesText', note: 'tfa.asideCodesNote', step: 'codes' },
];

interface AsideListProps {
  /** `navy` — desktop chap blok; `light` — forma ostida: telefonda izohsiz ro'yxat, planshetda ustunli kartalar. */
  tone: Tone;
  brand?: ReactNode;
  id: string;
  title: string;
  items: ReadonlyArray<AsideItem & { active: boolean }>;
  footnote?: string;
}

/** Kirish sahifasining yon bloki: sarlavha, qatorlar (faoli ajralib turadi) va ixtiyoriy izoh. */
function AsideList({ tone, brand, id, title, items, footnote }: AsideListProps) {
  const { t } = useTranslation();
  return (
    <aside className={tone === 'navy' ? styles.navy : styles.light} aria-labelledby={id}>
      {brand}
      <div className={styles.body}>
        <h2 id={id} className={styles.title}>{title}</h2>
        <dl className={styles.list}>
          {items.map((item) => (
            <div key={item.title} className={styles.method} aria-current={item.active ? 'true' : undefined}>
              <dt>{t(item.title)}</dt>
              <dd>{t(item.text)}</dd>
              <dd className={styles.note}>{t(item.note)}</dd>
            </div>
          ))}
        </dl>
        {footnote ? <p className={styles.footnote}>{footnote}</p> : null}
      </div>
    </aside>
  );
}

/** «Kirish usuli rolingizga bog'liq» (umumiy-kirish): tanlangan usul qatori ajralib turadi. */
export function LoginMethods({ tone, brand, active }: { tone: Tone; brand?: ReactNode; active: Active }) {
  const { t } = useTranslation();
  return (
    <AsideList
      tone={tone}
      brand={brand}
      id="login-methods"
      title={t('login.methodsTitle')}
      items={METHODS.map((method) => ({ ...method, active: method.activeFor.includes(active) }))}
    />
  );
}

/** «Ikkinchi kodni ulash» (umumiy-2fa-ulash): ilovani ulash va zaxira kodlar qadamlari. */
export function TwoFactorSetupSteps({ tone, brand, step }: { tone: Tone; brand?: ReactNode; step: SetupStep }) {
  const { t } = useTranslation();
  return (
    <AsideList
      tone={tone}
      brand={brand}
      id="tfa-setup-steps"
      title={t('tfa.asideTitle')}
      items={SETUP_STEPS.map((item) => ({ ...item, active: item.step === step }))}
      footnote={t('tfa.asideFootnote')}
    />
  );
}
