import { App } from 'antd';
import { ImageIcon, Send, TriangleAlert } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { useCreateProductMutation } from '../../features/adminProducts/api/adminProductsQueries';
import { missingFields, newProductConditions } from '../../features/adminProducts/lib/productConditions';
import { emptyProductForm, productBody } from '../../features/adminProducts/model/productForm';
import { ProductErrorSummary } from '../../features/adminProducts/ui/form/ProductFormParts';
import { ProductFormSections } from '../../features/adminProducts/ui/form/ProductFormSections';
import { useProductForm } from '../../features/adminProducts/ui/form/useProductForm';
import formStyles from '../../features/adminProducts/ui/form/ProductForm.module.css';
import { ConditionList, SideCard } from '../../features/adminProducts/ui/SideCard';
import { useWholesalersQuery } from '../../features/wholesalers/api/wholesalersQueries';
import { hasContract } from '../../features/wholesalers/lib/wholesalerRules';
import { getApiErrorMessage } from '../../shared/api/apiError';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { shortPersonName } from '../../shared/lib/personName';
import { useLeaveGuard } from '../../shared/lib/useLeaveGuard';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { Dialog, DialogCancel, DialogPrimary } from '../../shared/ui/Dialog/Dialog';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';
import styles from '../AdminProductDetailPage/AdminProductDetailPage.module.css';

const CARD_TABS = ['main', 'price', 'offer', 'creatives', 'landing', 'script', 'stock', 'audit'] as const;

/**
 * «Yangi mahsulot» (FE-25, OPT-2; admin-mahsulot-karta.holatlar «Qoralama — Yangi mahsulot»): optovik nomidan admin
 * kiritadi; faqat «Asosiy» yorlig'i ochiq, qolganlari birinchi saqlashdan keyin. «Moderatsiyaga yuborish» — majburiy
 * maydonlar to'ldirilgach (PENDING_REVIEW, moderatsiya navbatiga); «Qoralamani saqlash» — DRAFT (taklif §9).
 * `?wholesaler=` — optovik kartasidan kelganda oldindan tanlangan.
 */
export default function AdminProductNewPage() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const user = useAppSelector(selectAuthUser);
  const wholesalers = useWholesalersQuery();
  const create = useCreateProductMutation();
  const form = useProductForm(emptyProductForm(params.get('wholesaler') ?? ''));
  const guard = useLeaveGuard(form.dirty && !create.isPending);
  usePageTitle(t('apf.newTitle'));

  const selected = wholesalers.data?.find((item) => item.id === form.values.wholesalerId) ?? null;
  const signed = selected ? hasContract(selected) : false;
  const complete = Boolean(selected) && signed && !missingFields(form.values, true, t).length;
  const conditions = newProductConditions(form.values, selected ? { name: selected.name, signed } : null, t);
  const who = user?.name ? shortPersonName(user.name) : t('moderation.audit.system');

  const save = (draft: boolean) => {
    if (create.isPending) return;
    if (!form.validate({ isNew: true, requireCodes: false }, selected && !signed ? { wholesalerId: 'contract' } : {})) return;
    create.mutate({ wholesalerId: form.values.wholesalerId, body: productBody(form.values), images: form.values.images, videos: form.values.videos, draft }, {
      onSuccess: (saved) => {
        notification.success({ title: t(draft ? 'apf.createdDraft' : 'apf.created', { name: saved.name }), placement: phone ? 'top' : 'bottomRight', duration: 4 });
        form.commit(form.values);
        void navigate(`/admin/products/${encodeURIComponent(saved.id)}`, { replace: true });
      },
      onError: (error) => {
        if (!form.applyServerError(error)) notification.error({ title: t('apf.saveError'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
      },
    });
  };

  const submitButton = (
    <button type="button" className={formStyles.primary} disabled={!complete || create.isPending} onClick={() => save(false)} aria-busy={create.isPending || undefined}>
      <Send aria-hidden />{t('apf.side.submit')}
    </button>
  );

  return (
    <div className={styles.page}>
      <section className={styles.header} data-testid="product-header">
        <span className={styles.thumb}>
          <ImageIcon aria-hidden />
        </span>
        <div className={styles.headerText}>
          <div className={styles.badges}><StatusBadge family="product" code="DRAFT" /></div>
          <p>{t('apf.newMeta', { who })}</p>
        </div>
      </section>

      <div className={styles.tabs} role="tablist" aria-label={t('card.tabs')}>
        {CARD_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            className={styles.tab}
            aria-selected={key === 'main'}
            aria-disabled={key === 'main' ? undefined : true}
            title={key === 'main' ? undefined : t('apf.tabLocked')}
            data-locked={key === 'main' ? undefined : true}
          >
            {t(`card.tab.${key}` as TranslationKey)}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={t('card.tab.main')}>
        <div className={`${styles.columns} ${styles.mainLayout}`}>
          <div className={styles.mainColumn}>
            {form.failed ? <ProductErrorSummary errors={form.errors} /> : null}
            <ProductFormSections
              values={form.values}
              errors={form.errors}
              onChange={form.change}
              product={null}
              slugTouched={form.slugTouched}
              onSlugTouched={form.touchSlug}
              phone={phone}
              conflictName={form.conflictName}
            />
          </div>
          <div className={styles.sideColumn}>
            <SideCard title={t('card.status')} gap={14} testId="card-status">
              <div className={styles.statusLine}>
                <StatusBadge family="product" code="DRAFT" />
                <span>{t('apf.unsaved')}</span>
              </div>
              <div className={styles.statusConditions}><ConditionList caption={t('card.conditions')} items={conditions} /></div>
              <div className={formStyles.sideActions}>
                {phone ? null : submitButton}
                <button type="button" className={formStyles.secondary} disabled={create.isPending} onClick={() => save(true)}>{t('apf.side.saveDraft')}</button>
                <p>{t('apf.side.newHint')}</p>
              </div>
            </SideCard>
          </div>
        </div>
      </div>

      <PageActionBar>
        <div className={formStyles.phoneBar}>
          <div>{submitButton}</div>
          {complete ? null : <p><TriangleAlert aria-hidden />{t('apf.side.incomplete')}</p>}
        </div>
      </PageActionBar>

      {guard.pending ? (
        <Dialog
          open
          title={t('content.leaveTitle')}
          description={t('content.leaveText')}
          icon={<TriangleAlert />}
          tone="warning"
          onClose={guard.stay}
          testId="leave-dialog"
          footer={(
            <>
              <DialogCancel onClick={guard.stay}>{t('content.stay')}</DialogCancel>
              <DialogPrimary danger shortcut={false} onClick={guard.leave}>{t('content.leave')}</DialogPrimary>
            </>
          )}
        >
          {null}
        </Dialog>
      ) : null}
    </div>
  );
}
