import { CircleAlert, CirclePause, CirclePlay, ClipboardCheck, EllipsisVertical, FileUp, PackagePlus, Plus, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useWholesalerQuery } from '../../features/wholesalers/api/wholesalersQueries';
import { hasContract, productBlock } from '../../features/wholesalers/lib/wholesalerRules';
import type { Wholesaler } from '../../features/wholesalers/model/wholesalerTypes';
import { BankChangeDialog, ContractDialog, InviteOwnerDialog, ResumeDialog, ReviewDialog, SendActDialog, SuspendDialog } from '../../features/wholesalers/ui/WholesalerDialogs';
import { getApiErrorCode } from '../../shared/api/apiError';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { tashkentDateTime } from '../../shared/lib/tashkentTime';
import { Dialog } from '../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { DocumentsTab, HistoryTab, MoneyTab, ReturnsTab, StockTab } from './components/CardTabs';
import { GeneralTab } from './components/GeneralTab';
import { WholesalerHead } from './components/WholesalerHead';
import { WholesalerProducts } from './components/WholesalerProducts';
import { WholesalerShipments } from './components/WholesalerShipments';
import { CARD_TABS, parseCardTab, parseDialog, type CardDialog, type CardTab, type DialogOptions } from './model/cardView';
import { headMenuItems, type HeadAction } from './model/headMenu';
import styles from './AdminWholesalerPage.module.css';

/**
 * Optovik kartasi (FE-25, admin-optovik-karta + .planshet/.mobil/.holatlar): sarlavha, holat banneri (shartnomasiz,
 * to'xtatilgan, M2 arizasi), 8 yorliq (`?tab=`), oynalar (`?dialog=` — ro'yxat menyusidan ham). BE-07 + taklif §1–§8.
 */
export default function AdminWholesalerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { wholesalerId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const compact = useMediaQuery('(max-width: 1023.98px)');
  const query = useWholesalerQuery(wholesalerId);
  const wholesaler = query.data;
  usePageTitle(wholesaler?.name ?? null);
  const tab = parseCardTab(params.get('tab'));
  const dialog = parseDialog(params.get('dialog'));
  const [options, setOptions] = useState<DialogOptions>({});
  const [sheet, setSheet] = useState(false);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const openDialog = (next: CardDialog, preset: DialogOptions = {}) => {
    setOptions(preset);
    setParam('dialog', next);
  };
  const closeDialog = () => setParam('dialog', null);

  if (query.isError) {
    if (getApiErrorCode(query.error) === 'NOT_FOUND') {
      return (
        <section className={styles.notFound} data-testid="wholesaler-not-found">
          <h2>{t('whk.notFound')}</h2>
          <p>{t('whk.notFoundText')}</p>
          <Link to="/admin/wholesalers" className={styles.secondary}>{t('whk.backToList')}</Link>
        </section>
      );
    }
    return <LoadError error={query.error} onRetry={() => void query.refetch()} lastSuccessAt={query.dataUpdatedAt} variant="page" />;
  }
  if (!wholesaler) return <div className={styles.skeleton} aria-busy="true" style={{ height: 320 }} />;

  const onAction = (action: HeadAction) => {
    if (action === 'edit') void navigate(`/admin/wholesalers/${encodeURIComponent(wholesaler.id)}/edit`);
    else if (action === 'declare') void navigate(`/admin/wholesalers?tab=shipments&declare=1&wholesaler=${encodeURIComponent(wholesaler.id)}`);
    else if (action === 'addProduct') void navigate(`/admin/products/new?wholesaler=${encodeURIComponent(wholesaler.id)}`);
    else openDialog(action);
  };

  const stats = wholesaler.stats;
  const tabCount: Partial<Record<CardTab, number | undefined>> = { products: stats?.products.total, shipments: stats?.shipments.total };
  const pending = wholesaler.status === 'PENDING';

  const content = (): ReactNode => {
    if (tab === 'general') return <GeneralTab wholesaler={wholesaler} phone={phone} updatedAt={query.dataUpdatedAt} onDialog={openDialog} onEdit={() => onAction('edit')} />;
    if (tab === 'products') return <section className={styles.card}><WholesalerProducts wholesalerId={wholesaler.id} phone={phone} /></section>;
    if (tab === 'shipments') return <section className={styles.card}><WholesalerShipments wholesalerId={wholesaler.id} phone={phone} /></section>;
    if (tab === 'stock') return <StockTab wholesaler={wholesaler} phone={phone} />;
    if (tab === 'returns') return <ReturnsTab wholesaler={wholesaler} phone={phone} onDialog={openDialog} />;
    if (tab === 'money') return <MoneyTab wholesaler={wholesaler} phone={phone} />;
    if (tab === 'documents') return <DocumentsTab wholesaler={wholesaler} phone={phone} onDialog={openDialog} />;
    return <HistoryTab wholesaler={wholesaler} phone={phone} />;
  };

  return (
    <div className={styles.page} data-testid="wholesaler-card" data-layout={phone ? 'phone' : undefined}>
      <WholesalerHead wholesaler={wholesaler} compact={compact} phone={phone} onAction={onAction} onPhoneMenu={() => setSheet(true)} />
      <StateBanner wholesaler={wholesaler} onAction={onAction} />

      <div className={styles.tabs} role="tablist" aria-label={t('whk.tabs')}>
        {CARD_TABS.map((key) => (
          <button key={key} type="button" role="tab" className={styles.tab} aria-selected={tab === key} data-count={tabCount[key] !== undefined || undefined} onClick={() => setParam('tab', key === 'general' ? null : key)}>
            {t(`whk.tab.${key}` as TranslationKey)}
            {tabCount[key] !== undefined ? <span className={styles.count}>{tabCount[key]}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={t(`whk.tab.${tab}` as TranslationKey)}>{content()}</div>

      {phone ? <PageActionBar><PrimaryBar wholesaler={wholesaler} pending={pending} onAction={onAction} /></PageActionBar> : null}

      {phone ? (
        <Dialog open={sheet} onClose={() => setSheet(false)} title={wholesaler.name} description={t('whk.head.sheetSub')} icon={<EllipsisVertical />}>
          <ul className={styles.sheetMenu} role="menu">
            {phoneItems(wholesaler, t).map((item) => (
              <li role="none" key={item.key}>
                <button type="button" role="menuitem" aria-disabled={item.reason ? true : undefined} data-danger={item.danger || undefined} onClick={() => { if (item.reason) return; setSheet(false); onAction(item.key); }}>{item.icon}{item.label}</button>
                {item.reason ? <p className={styles.sheetHint}>{item.reason}</p> : null}
              </li>
            ))}
          </ul>
        </Dialog>
      ) : null}

      {dialog === 'contract' ? <ContractDialog wholesaler={wholesaler} initialFile={options.file ?? null} onClose={closeDialog} /> : null}
      {dialog === 'invite' ? <InviteOwnerDialog wholesaler={wholesaler} onClose={closeDialog} /> : null}
      {dialog === 'suspend' ? <SuspendDialog wholesaler={wholesaler} onClose={closeDialog} /> : null}
      {dialog === 'resume' ? <ResumeDialog wholesaler={wholesaler} onClose={closeDialog} /> : null}
      {dialog === 'act' ? <SendActDialog wholesaler={wholesaler} initialActId={options.actId ?? null} onClose={closeDialog} /> : null}
      {dialog === 'bank' ? <BankChangeDialog wholesaler={wholesaler} onClose={closeDialog} /> : null}
      {dialog === 'review' ? <ReviewDialog wholesaler={wholesaler} onClose={closeDialog} /> : null}
    </div>
  );
}

/** Telefon «⋮» varag'i: o'chiq bandlarning sababi ostida (holatlar §6, maslahat o'rniga). */
function phoneItems(wholesaler: Wholesaler, t: ReturnType<typeof useTranslation>['t']) {
  const block = productBlock(wholesaler);
  const active = wholesaler.status !== 'SUSPENDED' && wholesaler.status !== 'PENDING';
  const extra = active ? [
    { key: 'addProduct' as const, icon: <Plus aria-hidden />, label: t('whk.head.addProduct'), reason: block ? t(`whs.block.${block}` as TranslationKey) : null, danger: false },
    ...(hasContract(wholesaler) ? [] : [{ key: 'declare' as const, icon: <PackagePlus aria-hidden />, label: t('whs.declare'), reason: block ? t(`whs.block.${block}` as TranslationKey) : null, danger: false }]),
  ] : [];
  return [...extra, ...headMenuItems(wholesaler, true, t)];
}

function PrimaryBar({ wholesaler, pending, onAction }: { wholesaler: Wholesaler; pending: boolean; onAction: (action: HeadAction) => void }) {
  const { t } = useTranslation();
  if (pending) return <button type="button" className={styles.barPrimary} onClick={() => onAction('review')}><ClipboardCheck aria-hidden />{t('whk.head.review')}</button>;
  if (wholesaler.status === 'SUSPENDED') return <button type="button" className={styles.barPrimary} onClick={() => onAction('resume')}><CirclePlay aria-hidden />{t('whs.menu.resume')}</button>;
  if (!hasContract(wholesaler)) return <button type="button" className={styles.barPrimary} onClick={() => onAction('contract')}><FileUp aria-hidden />{t('whk.head.uploadContract')}</button>;
  return <button type="button" className={styles.barPrimary} onClick={() => onAction('declare')}><PackagePlus aria-hidden />{t('whs.declare')}</button>;
}

/** Holat banneri: shartnomasiz (OPT-1), to'xtatilgan (sabab, kim va qachon), M2 arizasi. */
function StateBanner({ wholesaler, onAction }: { wholesaler: Wholesaler; onAction: (action: HeadAction) => void }) {
  const { t } = useTranslation();
  if (wholesaler.status === 'PENDING') {
    return (
      <div className={styles.banner} data-tone="info" role="note">
        <CircleAlert aria-hidden />
        <div>
          <p className={styles.bannerTitle}>{t('whk.banner.pending')}</p>
          <p>{t('whk.banner.pendingText')}</p>
          <button type="button" className={styles.bannerLink} onClick={() => onAction('review')}>{t('whk.head.review')}</button>
        </div>
      </div>
    );
  }
  if (wholesaler.status === 'SUSPENDED') {
    const by = wholesaler.statusChangedBy ? ` · ${shortPersonName(wholesaler.statusChangedBy)}` : '';
    return (
      <div className={styles.banner} data-tone="neutral" role="note" data-testid="suspended-banner">
        <CirclePause aria-hidden />
        <div>
          <p className={styles.bannerTitle}>{t('whk.banner.suspended', { when: wholesaler.statusChangedAt ? tashkentDateTime(wholesaler.statusChangedAt) : '—', by })}</p>
          <p>{wholesaler.suspendReason ? t('whk.banner.suspendedReason', { reason: wholesaler.suspendReason }) : ''}{t('whk.banner.suspendedText')}</p>
        </div>
      </div>
    );
  }
  if (!hasContract(wholesaler)) {
    return (
      <div className={styles.banner} data-tone="warning" role="note" data-testid="no-contract-banner">
        <TriangleAlert aria-hidden />
        <div>
          <p className={styles.bannerTitle}>{t('whk.banner.noContract')}</p>
          <p>{t('whk.banner.noContractText')}</p>
          <button type="button" className={styles.bannerLink} onClick={() => onAction('contract')}>{t('whk.head.uploadContract')}</button>
        </div>
      </div>
    );
  }
  return null;
}
