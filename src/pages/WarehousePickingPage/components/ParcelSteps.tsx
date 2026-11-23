import { Check } from 'lucide-react';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import styles from '../WarehousePickingPage.module.css';

/** Posilka bosqichlari (ombor-yigish, ombor-qadoq): 1 Yig'ish → 2 Qadoq va yorliq → 3 Elchi'ga topshirish. */
export function ParcelSteps({ step, done }: { step: 1 | 2 | 3; done?: boolean }) {
  const { t } = useTranslation();
  const items = [
    { title: t('ful.step.pick'), sub: t(step > 1 || done ? 'ful.step.pickDone' : 'ful.step.pickSub') },
    { title: t('ful.step.pack'), sub: t('ful.step.packSub') },
    { title: t('ful.step.handover'), sub: t('ful.step.handoverSub') },
  ];
  return (
    <ol className={styles.steps} aria-label={t('ful.step.aria')}>
      {items.map((item, index) => {
        const number = index + 1;
        const state = number < step || (number === step && done) ? 'done' : number === step ? 'current' : 'next';
        return (
          <li key={item.title} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className={styles.stepHead}>
              <span className={styles.stepDot}>{state === 'done' ? <Check aria-hidden /> : number}</span>
              {number < items.length ? <span className={styles.stepLine} /> : null}
            </span>
            <span className={styles.stepText}><span>{item.title}</span><span>{item.sub}</span></span>
          </li>
        );
      })}
    </ol>
  );
}
