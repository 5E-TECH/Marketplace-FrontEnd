import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SellerProfile } from '../../../features/sellerProfile/api/sellerProfileApi';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../../shared/lib/tashkentTime';
import styles from '../AffiliateHomePage.module.css';

interface Step {
  number: number;
  title: TranslationKey;
  text: TranslationKey;
  action: TranslationKey;
  to: string;
  done: boolean;
}

interface OnboardingStepsProps {
  hasPages: boolean;
  profile: SellerProfile | undefined;
}

/**
 * «Birinchi qadamlar» (sotuvchi-royxat §4, sotuvchi-bosh 2-holat): yangi sotuvchi — hali
 * sahifasi yo'q. 1–3 — sotishni boshlash, 4–5 — pul yechishdan oldin (JShShIR, karta).
 */
export function OnboardingSteps({ hasPages, profile }: OnboardingStepsProps) {
  const { t } = useTranslation();
  const steps: Step[] = [
    { number: 1, title: 'onboarding.step1', text: 'onboarding.step1Text', action: 'onboarding.step1Action', to: '/affiliate/offers', done: hasPages },
    { number: 2, title: 'onboarding.step2', text: 'onboarding.step2Text', action: 'onboarding.step2Action', to: '/affiliate/offers', done: hasPages },
    // Reklama qoidalari — ofertaning 6-bo'limi; alohida sahifa keyingi kartada.
    { number: 3, title: 'onboarding.step3', text: 'onboarding.step3Text', action: 'onboarding.step3Action', to: '/profile/offer', done: false },
    { number: 4, title: 'onboarding.step4', text: 'onboarding.step4Text', action: 'onboarding.step4Action', to: '/profile/self-employed', done: profile?.selfEmployed.status === 'VERIFIED' },
    { number: 5, title: 'onboarding.step5', text: 'onboarding.step5Text', action: 'onboarding.step5Action', to: '/affiliate/balance', done: Boolean(profile?.card) },
  ];
  const done = steps.filter((step) => step.done).length;
  const groups = [
    { title: t('onboarding.groupSell'), hint: t('onboarding.groupSellHint'), steps: steps.slice(0, 3) },
    { title: t('onboarding.groupMoney'), hint: t('onboarding.groupMoneyHint'), steps: steps.slice(3) },
  ];

  return (
    <section className={`${styles.card} ${styles.onboarding}`} aria-labelledby="onboarding-title">
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 id="onboarding-title">{t('onboarding.title')}</h2>
          <p className={styles.muted}>
            {profile ? `${t('onboarding.registered', { time: tashkentDateTime(profile.registeredAt) })} ` : ''}
            {t('onboarding.lead')}
          </p>
        </div>
        <div className={styles.progress}>
          <span>{t('onboarding.progress', { done, total: steps.length })}</span>
          <progress max={steps.length} value={done} aria-label={t('onboarding.progress', { done, total: steps.length })} />
        </div>
      </header>
      <div className={styles.stepGroups}>
        {groups.map((group) => (
          <div key={group.title} className={styles.stepGroup}>
            <h3>
              {group.title} <span className={styles.muted}>{group.hint}</span>
            </h3>
            <ol className={styles.stepList}>
              {group.steps.map((step) => (
                <li key={step.number} data-done={step.done}>
                  <span className={styles.stepNumber} aria-hidden>{step.done ? <Check size={14} /> : step.number}</span>
                  <div className={styles.stepBody}>
                    <strong>
                      {t(step.title)}
                      {step.done ? <span className={styles.visuallyHidden}> — {t('onboarding.done')}</span> : null}
                    </strong>
                    <span className={styles.muted}>{t(step.text)}</span>
                    {step.done ? null : <Link to={step.to} className={styles.stepLink}>{t(step.action)}</Link>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
