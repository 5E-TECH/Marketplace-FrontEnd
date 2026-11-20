import { Keyboard } from 'lucide-react';
import { Fragment } from 'react';
import { DialogCancel, OperatorDialog } from '../../features/operator/ui/OperatorDialog';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import styles from './HelpDialog.module.css';

interface KeyRow { keys: readonly string[]; title: TranslationKey; text: TranslationKey }

const GROUPS: ReadonlyArray<{ label: TranslationKey; rows: readonly KeyRow[] }> = [
  { label: 'opw.helpGroupQueue', rows: [{ keys: ['F2'], title: 'opw.next', text: 'opw.key.nextText' }] },
  {
    label: 'opw.helpGroupResult',
    rows: [
      { keys: ['Alt', '1'], title: 'opw.outcome.CONFIRMED', text: 'opw.key.1' },
      { keys: ['Alt', '2'], title: 'opw.noAnswerTile', text: 'opw.key.2' },
      { keys: ['Alt', '3'], title: 'opw.outcome.CALL_LATER', text: 'opw.key.3' },
      { keys: ['Alt', '4'], title: 'opw.outcome.THINKING', text: 'opw.key.4' },
      { keys: ['Alt', '5'], title: 'opw.outcome.REJECTED', text: 'opw.key.5' },
      { keys: ['Alt', '6'], title: 'opw.outcome.INVALID', text: 'opw.key.6' },
      { keys: ['Alt', '7'], title: 'opw.outcome.DUPLICATE', text: 'opw.key.7' },
    ],
  },
  {
    label: 'opw.helpGroupSave',
    rows: [
      { keys: ['Ctrl', 'Enter'], title: 'opw.key.save', text: 'opw.key.saveText' },
      { keys: ['Esc'], title: 'opw.key.close', text: 'opw.key.closeText' },
      { keys: ['?'], title: 'opw.key.help', text: 'opw.key.helpText' },
    ],
  },
];

const RULES: ReadonlyArray<{ title: TranslationKey; text: TranslationKey }> = [
  { title: 'opw.rule.1.title', text: 'opw.rule.1' },
  { title: 'opw.rule.2.title', text: 'opw.rule.2' },
  { title: 'opw.rule.3.title', text: 'opw.rule.3' },
  { title: 'opw.rule.4.title', text: 'opw.rule.4' },
  { title: 'opw.rule.5.title', text: 'opw.rule.5' },
  { title: 'opw.rule.6.title', text: 'opw.rule.6' },
  { title: 'opw.rule.7.title', text: 'opw.rule.7' },
  { title: 'opw.rule.8.title', text: 'opw.rule.8' },
];

const TALK: ReadonlyArray<{ title: TranslationKey; text: TranslationKey }> = [
  { title: 'opw.talk.1.title', text: 'opw.talk.1' },
  { title: 'opw.talk.2.title', text: 'opw.talk.2' },
  { title: 'opw.talk.3.title', text: 'opw.talk.3' },
];

/** «Tezkor tugmalar va qoidalar» (operator-yordam): chapda tugmalar, o'ngda lid qoidalari. */
export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <OperatorDialog
      open
      width={860}
      title={t('opw.help')}
      description={t('opw.helpText')}
      icon={<Keyboard />}
      tone="neutral"
      onClose={onClose}
      footer={<><span className={styles.footNote}>{t('opw.helpAdmin')}</span><DialogCancel onClick={onClose}>{t('opw.close')}</DialogCancel></>}
    >
      <div className={styles.columns}>
        <section>
          <h4 className={styles.heading}>{t('opw.helpKeys')}</h4>
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className={styles.group}>{t(group.label)}</p>
              <ul className={styles.list}>
                {group.rows.map((row) => (
                  <li key={row.keys.join('+')}>
                    <span className={styles.keys}>
                      {row.keys.map((key, index) => (
                        <Fragment key={key}>
                          {index ? <span className={styles.plus}>+</span> : null}
                          <kbd className={styles.kbd}>{key}</kbd>
                        </Fragment>
                      ))}
                    </span>
                    <span><strong>{t(row.title)}</strong><small>{t(row.text)}</small></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className={styles.typing}><Keyboard size={14} aria-hidden />{t('opw.helpTypingLong')}</p>
        </section>
        <section>
          <h4 className={styles.heading}>{t('opw.helpRules')}</h4>
          <ol className={styles.rules}>
            {RULES.map((rule, index) => (
              <li key={rule.title}><span className={styles.number}>{index + 1}</span><span><strong>{t(rule.title)}</strong><small>{t(rule.text)}</small></span></li>
            ))}
          </ol>
          <p className={styles.group}>{t('opw.helpGroupTalk')}</p>
          <ul className={styles.talk}>
            {TALK.map((item) => <li key={item.title}><strong>{t(item.title)}</strong><small>{t(item.text)}</small></li>)}
          </ul>
        </section>
      </div>
    </OperatorDialog>
  );
}
