import { Check } from 'lucide-react';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from '../RegisterPage.module.css';

const STEPS: ReadonlyArray<{ title: TranslationKey; hint: TranslationKey }> = [
  { title: 'register.step1', hint: 'register.step1Hint' },
  { title: 'register.step2', hint: 'register.step2Hint' },
  { title: 'register.step3', hint: 'register.step3Hint' },
];

/** «Ro‘yxat bosqichlari»: o'tilgani — navy belgi va «tasdiqlandi», joriysi — `aria-current="step"`. */
export function RegisterSteps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  return (
    <ol className={styles.steps} aria-label={t('register.steps')}>
      {STEPS.map((step, index) => {
        const number = index + 1;
        const state = number < current ? 'done' : number === current ? 'current' : 'next';
        return (
          <li key={step.title} className={styles.step} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className={styles.stepHead}>
              <span className={styles.stepDot} aria-hidden>
                {state === 'done' ? <Check size={16} /> : number}
              </span>
              {number < STEPS.length ? <span className={styles.stepLine} aria-hidden /> : null}
            </span>
            <span className={styles.stepText}>
              <span className={styles.stepTitle}>{t(step.title)}</span>
              <span className={styles.stepHint}>{state === 'done' ? t('register.stepDone') : t(step.hint)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
