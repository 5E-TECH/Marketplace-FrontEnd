import axios from 'axios';
import { ArrowRightLeft, Ellipsis, Headphones, History, LockOpen, RotateCcw, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAdminLeadQuery } from '../../features/adminLeads/api/adminLeadsQueries';
import { withinDays } from '../../features/adminLeads/lib/leadRows';
import type { AdminLeadCard } from '../../features/adminLeads/model/adminLeadTypes';
import { ListenDialog } from '../../features/adminLeads/ui/ListenDialog';
import { ReleaseDialog } from '../../features/adminLeads/ui/ReleaseDialog';
import { ReopenDialog } from '../../features/adminLeads/ui/ReopenDialog';
import { TransferDialog } from '../../features/adminLeads/ui/TransferDialog';
import { useCurrentUserQuery } from '../../features/auth/api/useCurrentUserQuery';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { useNow } from '../../shared/lib/useNow';
import { Dialog } from '../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { LeadNow, type LeadAction } from './components/LeadNow';
import { AttemptsSection, CustomerSection, DuplicateNote, DuplicateSection, HistorySection, OrderSection, ProductSection, SourceSection } from './components/LeadSections';
import record from '../../shared/ui/RecordCard/RecordCard.module.css';
import own from './AdminLeadPage.module.css';

const styles = { ...record, ...own };

type DialogState = { kind: 'transfer' | 'release' | 'reopen' | 'sheet' } | { kind: 'listen'; index: number } | null;

const OPEN = ['NEW', 'BOOKED', 'CALLBACK'];

/**
 * Lid kartasi (FE-26, admin-lid-karta; `GET /admin/leads/{id}`): «Hozir» bloki (holat, lid yo'li, ko'rsatkichlar,
 * amallar), mijoz, mahsulot va narx, urinishlar (yozuvlar bilan), lid tarixi, manba va klik, dublikat, buyurtma.
 * Admin — to'liq raqam, qayta ochish, bronni bo'shatish, yozuvni yuklab olish; nazoratchi — o'qish, tinglash, o'tkazish.
 */
export default function AdminLeadPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { leadId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const role = useCurrentUserQuery().data?.role;
  const admin = role === 'ADMIN' || role === 'SUPERADMIN';
  const base = admin ? '/admin/leads' : '/supervisor/leads';
  const phone = useMediaQuery('(max-width: 767.98px)');
  const now = useNow();
  const query = useAdminLeadQuery(leadId);
  const lead = query.data;
  const [dialog, setDialog] = useState<DialogState>(null);
  usePageTitle(leadId);

  const leadHref = (id: string) => `${base}/${encodeURIComponent(id)}`;
  const orderHref = (id: string) => `${admin ? '/admin/orders' : '/supervisor/orders'}/${encodeURIComponent(id)}`;
  const latestRecording = lead ? (lead.attemptLog ?? []).map((attempt, index) => ({ attempt, index })).filter(({ attempt }) => attempt.recording === 'READY').at(-1) ?? null : null;

  // Ro'yxatdagi «Yozuvni tinglash» (`?listen=1`) — oxirgi yozuv oynasi ochiq; yopilganda parametr olib tashlanadi.
  const requested: DialogState = params.get('listen') && latestRecording ? { kind: 'listen', index: latestRecording.index } : null;
  const active = dialog ?? requested;
  const closeDialog = () => {
    setDialog(null);
    if (!params.has('listen')) return;
    const next = new URLSearchParams(params);
    next.delete('listen');
    setParams(next, { replace: true });
  };

  const onAction = (action: LeadAction) => {
    if (action === 'attempts') {
      setDialog(null);
      document.getElementById('lead-attempts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (action === 'listen') {
      if (latestRecording) setDialog({ kind: 'listen', index: latestRecording.index });
      return;
    }
    setDialog({ kind: action });
  };

  if (query.isPending) {
    return (
      <div className={styles.page} aria-busy="true" data-testid="lead-card-loading">
        <span className={styles.skeleton} style={{ height: 220 }} />
        <span className={styles.skeleton} style={{ height: 320 }} />
      </div>
    );
  }
  if (!lead) {
    const notFound = axios.isAxiosError(query.error) && query.error.response?.status === 404;
    return notFound ? (
      <section className={styles.notFound} data-testid="lead-not-found">
        <span aria-hidden><SearchX /></span>
        <h2>{t('alk.notFound', { id: leadId })}</h2>
        <p>{t('alk.notFoundText')}</p>
        <Link to={base} className={styles.secondary}>{t('alk.back')}</Link>
      </section>
    ) : <LoadError variant="page" error={query.error} onRetry={() => void query.refetch()} lastSuccessAt={query.dataUpdatedAt} />;
  }

  const open = OPEN.includes(lead.status);
  const reopenOpen = lead.status === 'REJECTED' && (!lead.rejectedAt || withinDays(lead.rejectedAt, 3, now));
  const listen = active?.kind === 'listen' ? lead.attemptLog?.[active.index] ?? null : null;

  return (
    <div className={styles.page} data-layout={phone ? 'phone' : undefined} data-testid="lead-card">
      <DuplicateNote lead={lead} now={now} leadHref={leadHref} />
      <LeadNow lead={lead} admin={admin} phone={phone} now={now} orderHref={orderHref} leadHref={leadHref} onAction={onAction} />
      <div className={styles.columns}>
        <div className={styles.main}>
          <CustomerSection lead={lead} admin={admin} phone={phone} now={now} />
          <ProductSection lead={lead} admin={admin} phone={phone} />
          <AttemptsSection lead={lead} phone={phone} now={now} onListen={(index) => setDialog({ kind: 'listen', index })} />
          <HistorySection lead={lead} phone={phone} now={now} />
        </div>
        <div className={styles.side}>
          <SourceSection lead={lead} admin={admin} phone={phone} />
          <DuplicateSection lead={lead} phone={phone} leadHref={leadHref} />
          <OrderSection lead={lead} phone={phone} now={now} orderHref={orderHref} />
        </div>
      </div>

      {open ? (
        <PageActionBar>
          <button type="button" className={styles.barButton} onClick={() => setDialog({ kind: 'transfer' })}>
            <ArrowRightLeft aria-hidden />
            {t('alk.a.transfer')}
          </button>
        </PageActionBar>
      ) : null}

      {active?.kind === 'transfer' ? <TransferDialog leads={[transferLead(lead)]} cards onClose={closeDialog} /> : null}
      {active?.kind === 'release' ? <ReleaseDialog lead={lead} onClose={closeDialog} /> : null}
      {active?.kind === 'reopen' ? <ReopenDialog lead={reopenLead(lead, t)} onClose={closeDialog} onOpenLead={(id) => void navigate(leadHref(id))} /> : null}
      {listen && active?.kind === 'listen' ? (
        <ListenDialog lead={{ id: lead.id, customerName: lead.customerName, productName: lead.product.name, status: lead.status }} attempt={listen} number={active.index + 1} canDownload={admin} onClose={closeDialog} />
      ) : null}
      {active?.kind === 'sheet' ? (
        <Dialog open title={t('alk.a.sheetTitle', { id: lead.id })} description={[lead.customerName, t(`status.lead.${lead.status}`), lead.operator?.name].filter(Boolean).join(' · ')} icon={<Ellipsis />} onClose={closeDialog}>
          <ul className={styles.sheetMenu} role="menu">
            {admin && lead.status === 'BOOKED' ? (
              <li role="none"><button type="button" role="menuitem" onClick={() => setDialog({ kind: 'release' })}><LockOpen aria-hidden />{t('alk.a.release')}</button></li>
            ) : null}
            {latestRecording ? (
              <li role="none"><button type="button" role="menuitem" onClick={() => setDialog({ kind: 'listen', index: latestRecording.index })}><Headphones aria-hidden />{t('alk.a.listen')}</button></li>
            ) : null}
            {lead.attemptLog?.length ? (
              <li role="none"><button type="button" role="menuitem" onClick={() => onAction('attempts')}><History aria-hidden />{t('alk.a.attempts')}</button></li>
            ) : null}
            {admin ? (
              <li role="none">
                <button type="button" role="menuitem" aria-disabled={!reopenOpen || undefined} aria-describedby={reopenOpen ? undefined : 'lead-reopen-hint'} onClick={() => reopenOpen && setDialog({ kind: 'reopen' })}>
                  <RotateCcw aria-hidden />
                  {t('alk.a.reopen')}
                </button>
                {reopenOpen ? null : <p id="lead-reopen-hint" className={styles.sheetHint}>{t('alk.a.reopenHint')}</p>}
              </li>
            ) : null}
          </ul>
        </Dialog>
      ) : null}
    </div>
  );
}

function transferLead(lead: AdminLeadCard) {
  return {
    id: lead.id,
    customerName: lead.customerName,
    productName: lead.product.name,
    streamCode: lead.stream?.code ?? null,
    status: lead.status,
    operatorId: lead.operator?.id ?? null,
    operatorName: lead.operator?.name ?? null,
    callbackAt: lead.status === 'CALLBACK' ? lead.nextAttemptAt : null,
    createdAt: lead.createdAt,
    queuePosition: lead.queuePosition ?? null,
    bookedUntil: lead.bookedUntil,
    callStartedAt: lead.operator?.callStartedAt ?? null,
  };
}

function reopenLead(lead: AdminLeadCard, t: (key: TranslationKey) => string) {
  return {
    id: lead.id,
    customerName: lead.customerName,
    productName: lead.product.name,
    streamCode: lead.stream?.code ?? null,
    affiliateName: lead.affiliateName ?? lead.stream?.affiliateName ?? null,
    rejectedAt: lead.rejectedAt ?? null,
    operatorName: lead.closedBy?.name ?? lead.attempts.at(-1)?.operatorName ?? null,
    closedNote: lead.rejectReason ? `«${t(`opw.reject.${lead.rejectReason}`)}»` : null,
  };
}
