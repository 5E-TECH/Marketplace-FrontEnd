import { Dropdown } from 'antd';
import { CalendarClock, ChevronDown, ChevronUp, CircleAlert, CodeXml, Ellipsis, Lock, PackageX, RotateCcw, Timer } from 'lucide-react';
import { useState } from 'react';
import { clock, dayLabel, mmss, outcomeLabel, rejectLabel, sourceMark, statusLabel, sum } from '../../features/operator/lib/leadFormat';
import { CALLBACK_GRACE_MINUTES, isNoAnswer, leadKind, scriptSteps } from '../../features/operator/lib/leadRules';
import { useNow } from '../../shared/lib/useNow';
import type { LeadCard } from '../../features/operator/model/operatorTypes';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import styles from './OperatorWorkspace.module.css';
import { Badge } from '../../shared/ui/Badge/Badge';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';

/** Skriptdagi summalar qalin (dizayndagidek): «262 000 so‘m». */
function withAmounts(text: string) {
  return text.split(/(\d[\d\s\u00a0]*\d\s?so[‘']m)/).map((part, index) => (index % 2 ? <strong key={index} className={styles.amount}>{part}</strong> : part));
}

interface LeadCardViewProps {
  card: LeadCard;
  onProductInfo: () => void;
  onHelp: () => void;
}

/**
 * Lid kartasi (operator-lid-kartasi): sarlavha «Ism · Viloyat (formadan)», holat belgilari, lid turi
 * izohi, mahsulot va narx, mijoz yozgan manzil «formadan» (DZ-12, TC5), suhbat skripti, oldingi lidlar,
 * urinishlar va tarix. S1/S3 varianti operatorga ko'rsatilmaydi (ko'r sinov).
 */
export function LeadCardView({ card, onProductInfo, onHelp }: LeadCardViewProps) {
  const { t } = useTranslation();
  const now = useNow();
  const [previousOpen, setPreviousOpen] = useState(true);
  const [attemptsOpen, setAttemptsOpen] = useState(true);
  const kind = leadKind(card);
  const steps = scriptSteps(card.callScript);
  const left = card.bookedUntil ? Date.parse(card.bookedUntil) - now : null;
  const scheduledAt = card.status === 'CALLBACK' ? card.nextAttemptAt : null;
  const lastAttempt = card.attempts.at(-1);
  const failed = card.attempts.filter((attempt) => isNoAnswer(attempt.outcome)).length;
  const sameDay = (value: string) => dayLabel(value) === dayLabel(now);
  const at = (value: string) => (sameDay(value) ? clock(value) : `${dayLabel(value)}, ${clock(value)}`);

  return (
    <section className={`${styles.panel} ${styles.card}`} aria-labelledby="lead-card-title" data-testid="lead-card">
      <div className={styles.cardHead}>
        <div className={styles.cardTitleRow}>
          <h2 id="lead-card-title" className={styles.cardTitle}>
            {card.customerName}
            {card.address ? <span className={styles.cardRegion}> · {card.address.regionName}</span> : null}{' '}
            <span className={styles.cardSource}>({sourceMark(card, t)})</span>
          </h2>
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                { key: 'product', label: t('opw.productInfo'), onClick: onProductInfo },
                { type: 'divider' },
                { key: 'help', label: t('opw.help'), onClick: onHelp },
              ],
            }}
          >
            <button type="button" className={styles.iconButton} aria-label={t('opw.leadActions')} title={t('opw.leadActions')}>
              <Ellipsis size={20} aria-hidden />
            </button>
          </Dropdown>
        </div>
        <div className={styles.cardMeta}>
          <span className={styles.leadId}>{t('opw.leadNumber', { id: card.id })}</span>
          <StatusBadge family="lead" code={card.status} titlePrefix={t('opw.statusTitle')} />
          {left !== null ? (
            <Badge tone={left <= 60_000 ? 'warning' : 'neutral'} icon={Timer} testId="booking-left" title={t('opw.bookingUntil', { time: clock(card.bookedUntil ?? '') })}>
              {left > 0 ? t('opw.bookingLeft', { time: mmss(left) }) : t('opw.bookingEnded')}
            </Badge>
          ) : null}
          {kind === 'scheduled' && scheduledAt ? (
            <>
              <Badge tone="info" icon={CalendarClock}>{t('opw.kind.scheduled', { time: clock(scheduledAt) })}</Badge>
              <Badge tone="neutral" icon={Timer}>{t('opw.scheduledUntil', { time: clock(Date.parse(scheduledAt) + CALLBACK_GRACE_MINUTES * 60_000) })}</Badge>
            </>
          ) : null}
          {kind === 'retry' ? <Badge tone="warning" icon={RotateCcw}>{t('opw.kind.retry', { n: card.attemptsCount + 1 })}</Badge> : null}
          {kind === 'last' ? <Badge tone="danger" icon={CircleAlert}>{t('opw.kind.last', { n: card.attemptsCount + 1 })}</Badge> : null}
          {card.source === 'API' ? <Badge tone="neutral" icon={CodeXml}>{t('opw.apiTitle')}</Badge> : null}
          {card.stockShortage ? <Badge tone="danger" icon={PackageX}>{t('opw.stockTitle')}</Badge> : null}
        </div>
      </div>

      {kind === 'scheduled' && scheduledAt ? (
        <div className={styles.notice}>
          <CalendarClock aria-hidden />
          <div>
            {lastAttempt?.comment ? <strong>{t('opw.kindScheduledSaid', { time: clock(lastAttempt.at), comment: lastAttempt.comment })}</strong> : null}
            <p>{t('opw.kindScheduledText', { time: clock(scheduledAt) })}</p>
          </div>
        </div>
      ) : null}
      {kind === 'retry' && lastAttempt ? (
        <div className={styles.notice}>
          <RotateCcw aria-hidden />
          <div><strong>{t('opw.kindRetryTitle', { count: failed || card.attemptsCount })}</strong><p>{t('opw.kindRetryText', { time: clock(lastAttempt.at) })}</p></div>
        </div>
      ) : null}
      {kind === 'last' ? (
        <div className={styles.notice} data-tone="warning">
          <CircleAlert aria-hidden />
          <div><strong>{t('opw.kindLastTitle')}</strong><p>{t('opw.kindLastText')}</p></div>
        </div>
      ) : null}
      {card.source === 'API' ? (
        <div className={styles.notice} data-tone="info">
          <CodeXml aria-hidden />
          <div><strong>{t('opw.apiLead')}</strong><p>{t('opw.apiText')}{card.address ? '' : ` ${t('opw.apiNoAddress')}`}</p></div>
        </div>
      ) : null}
      {card.stockShortage ? (
        <div className={styles.notice} data-tone="danger" role="alert">
          <PackageX aria-hidden />
          <div><strong>{t('opw.stockLead', { product: card.product.name })}</strong><p>{t('opw.stockText')}</p></div>
        </div>
      ) : null}

      <dl className={styles.facts}>
        <dt>{t('opw.phone')}</dt>
        <dd><span className={styles.hidden}><Lock size={16} aria-hidden /><span>{t('opw.phoneHidden')}</span></span></dd>
        <dt>{t('opw.source')}</dt>
        <dd>{t(`opw.source.${card.source}` as TranslationKey)} · {t('opw.requestAt')} <span className={styles.tabular}>{at(card.createdAt)}</span></dd>
        <dt>{t('opw.product')}</dt>
        <dd>
          <strong>{card.product.name}{card.quantity > 1 ? ` × ${card.quantity}` : ''}</strong>
          <button type="button" className={styles.linkButton} onClick={onProductInfo}>{t('opw.productInfo')}</button>
        </dd>
        <dt>{t('opw.price')}</dt>
        <dd>
          <span className={`${styles.tabular} ${styles.nowrap}`}>{sum(card.price?.subtotal ?? card.product.salePrice)}</span>
          {card.price ? <> + {t('opw.deliveryWord')} <span className={`${styles.tabular} ${styles.nowrap}`}>{sum(card.price.deliveryFee)}</span></> : null}
        </dd>
        <dt>{t('opw.address')}</dt>
        <dd data-testid="lead-address">
          {card.address ? (
            <>
              {[card.address.regionName, card.address.districtName, card.address.addressLine].join(', ')}
              <span className={styles.formMark}>{card.address.confirmedAt ? t('opw.addressConfirmed') : t('opw.fromForm')}</span>
            </>
          ) : (
            <span className={styles.muted}>{t('opw.addressMissing')}</span>
          )}
        </dd>
      </dl>

      <div className={styles.section}>
        <h3>{t('opw.script')}</h3>
        {steps.length ? (
          <ol className={styles.script}>
            {steps.map((step, index) => <li key={index}><span>{index + 1}.</span><span>{withAmounts(step)}</span></li>)}
          </ol>
        ) : (
          <p className={styles.emptyBox}>{t('opw.scriptEmpty')}</p>
        )}
      </div>

      <div className={styles.collapsibles}>
        <div>
          <button type="button" className={styles.collapseButton} aria-expanded={previousOpen} onClick={() => setPreviousOpen((value) => !value)}>
            <span>{t('opw.previous')}</span>
            {previousOpen ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
          </button>
          {previousOpen ? (
            card.previousLeads.length ? (
              <div className={styles.rows}>
                {card.previousLeads.map((lead) => (
                  <div key={lead.id} className={styles.row}>
                    <span className={styles.rowDate}>{dayLabel(lead.createdAt)}</span>
                    <span className={styles.rowGrow}>{lead.productName}</span>
                    <span className={styles.rowTail}>
                      <StatusBadge family="lead" code={lead.status} titlePrefix={t('opw.statusTitle')} />
                      {lead.rejectReason ? <span className={styles.rowTailText}>«{rejectLabel(lead.rejectReason, t)}»</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyBox}>{t('opw.previousEmpty')}</p>
            )
          ) : null}
        </div>

        <div>
          <button type="button" className={styles.collapseButton} aria-expanded={attemptsOpen} onClick={() => setAttemptsOpen((value) => !value)}>
            <span>{t('opw.attemptsTitle')}{card.attempts.length ? <span> · {kind === 'last' ? `${card.attempts.length} / 6` : card.attempts.length}</span> : null}</span>
            {attemptsOpen ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
          </button>
          {attemptsOpen ? (
            <div className={styles.attempts}>
              {card.attempts.length ? (
                <div className={styles.rows}>
                  {card.attempts.map((attempt, index) => (
                    <div key={`${attempt.at}-${index}`} className={styles.row}>
                      <span className={styles.attemptNo}>{t('opw.attemptN', { n: index + 1 })}</span>
                      <span className={styles.attemptTime} data-wide={!sameDay(attempt.at) || undefined}>{at(attempt.at)}</span>
                      <span className={styles.rowGrow}>{attempt.operatorName}</span>
                      <span className={styles.rowTail}>
                        <span className={styles.rowTailText}>{outcomeLabel(attempt.outcome, t)}{attempt.comment ? ` · «${attempt.comment}»` : ''}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyBox}>{t('opw.attemptsEmpty')}</p>
              )}
              <p className={styles.note}>{t('opw.rulesText')}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('opw.history')}</h3>
        <ol className={styles.history}>
          {card.history.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              <span className={styles.historyRail} aria-hidden><span />{index < card.history.length - 1 ? <span /> : null}</span>
              <span className={styles.historyBody}>
                <span>{clock(entry.at)}</span>
                <span>
                  {entry.fromStatus === null
                    ? t('opw.historyArrived')
                    : entry.toStatus === 'BOOKED'
                      ? t('opw.historyBooked', { actor: entry.actor })
                      : t('opw.historyChanged', { status: statusLabel(entry.toStatus, t), actor: entry.actor })}
                  {entry.note ? <span className={styles.muted}> · {entry.note}</span> : null}
                </span>
                <StatusBadge family="lead" code={entry.toStatus} titlePrefix={t('opw.statusTitle')} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
