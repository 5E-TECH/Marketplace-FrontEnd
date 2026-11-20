import { App } from 'antd';
import { ChevronRight, CircleX, Eye, ImageIcon, Lock, RefreshCw, TriangleAlert, Video } from 'lucide-react';
import { useId, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAffiliateStreamsQuery } from '../../features/affiliate/api/affiliateApi';
import { useAffiliateOfferQuery, useAllAffiliateOffersQuery, useUpdateStreamMutation, type AffiliateStream } from '../../features/affiliate/api/offersApi';
import { feeAt, priceIssue } from '../../features/affiliate/lib/offerMath';
import type { StreamTemplate } from '../../features/affiliate/model/offerTypes';
import { AdRulesDialog } from '../../features/affiliate/ui/AdRules';
import { CopyLinkButton, StreamLinkBox } from '../../features/affiliate/ui/StreamLink';
import { StreamReadyPanel } from '../../features/affiliate/ui/StreamReadyPanel';
import { TemplatePreviewDialog } from '../../features/affiliate/ui/TemplatePreviewDialog';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentClock, tashkentDateTime } from '../../shared/lib/tashkentTime';
import { useLeaveGuard } from '../../shared/lib/useLeaveGuard';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { DialogCancel, DialogPrimary, Dialog } from '../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { formatMoney, formatMoneyNbsp } from '../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { StatusBadge } from '../../shared/ui/StatusBadge/StatusBadge';
import { ChangesCard } from './components/ChangesCard';
import { PriceCard } from './components/PriceCard';
import { pricedOffer, type PricedOffer } from './model/pricedOffer';
import { formOf, formPatch, linkWithSubs, pixelErrors, SUB_KEYS, type StreamForm } from './model/streamForm';
import styles from './AffiliatePageSettingsPage.module.css';

const TEMPLATES: readonly { value: StreamTemplate; icon: typeof ImageIcon; hint: TranslationKey }[] = [
  { value: 'STANDART', icon: ImageIcon, hint: 'settings.templateStandard' },
  { value: 'VIDEO', icon: Video, hint: 'settings.templateVideo' },
];

/**
 * «Sahifani sozlash» (FE-05, SOT-3; sotuvchi-sahifa-sozlash): shablon, narx (+ustama chegarasigacha),
 * sub1–sub5 va Meta / TikTok piksel. Postback URL, siri va CAPI tokeni — FE-28 (karta TC6). Platforma
 * to'xtatgan sahifa — faqat o'qish uchun.
 */
export default function AffiliatePageSettingsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const streams = useAffiliateStreamsQuery();
  const stream = streams.data?.items.find((item) => item.id === id);
  const detail = useAffiliateOfferQuery(stream?.productId);
  const list = useAllAffiliateOffersQuery();
  const offer = pricedOffer(detail.data, list.data?.items.find((item) => item.productId === stream?.productId));

  if (streams.isError && !streams.data) return <LoadError variant="page" error={streams.error} onRetry={() => void streams.refetch()} />;
  if (streams.data && !stream) return <LoadError variant="page" error={new Error(t('settings.notFound'))} onRetry={() => void streams.refetch()} />;
  if (!stream || !offer) {
    if (detail.isError && list.isError) return <LoadError variant="page" error={detail.error} onRetry={() => void list.refetch()} />;
    return <div className={styles.loading} aria-busy="true" aria-label={t('offers.loading')} />;
  }
  // Sahifa almashsa — forma yangidan (oldingi sahifaning kiritilganlari qolmasin).
  return <StreamSettings key={stream.id} stream={stream} offer={offer} />;
}

function StreamSettings({ stream, offer }: { stream: AffiliateStream; offer: PricedOffer }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const update = useUpdateStreamMutation();
  const [form, setForm] = useState<StreamForm>(() => formOf(stream));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [preview, setPreview] = useState<StreamTemplate | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const ids = useId();
  const readOnly = stream.status === 'STOPPED';
  const patch = formPatch(stream, form);
  const dirty = !readOnly && Object.keys(patch).length > 0;
  const pixels = pixelErrors(form);
  const priceBad = form.price === null || priceIssue(offer, form.price) !== null;
  const invalid = priceBad || pixels.meta || pixels.tiktok;
  const guard = useLeaveGuard(dirty);
  const sum = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const set = (next: Partial<StreamForm>) => setForm((current) => ({ ...current, ...next }));

  const save = (after?: () => void) =>
    update.mutate(
      { id: stream.id, patch },
      {
        onSuccess: (saved) => {
          setForm(formOf(saved));
          setSavedAt(Date.now());
          notification.success({
            title: t('settings.savedToast'),
            description: t('settings.savedToastText', { code: saved.code, price: sum(saved.salePrice), fee: sum(feeAt(offer, saved.salePrice)) }),
            placement: phone ? 'top' : 'bottomRight',
            duration: 4,
          });
          after?.();
        },
      },
    );
  const reset = () => setForm(formOf(stream));

  const subtitle = savedAt
    ? t('settings.savedAt', { product: stream.productName, time: tashkentClock(savedAt) })
    : t('settings.createdAt', { product: stream.productName, date: tashkentDateTime(stream.createdAt) });

  return (
    <div className={styles.page}>
      {readOnly ? (
        <>
          <div className={styles.banner} role="status">
            <Lock aria-hidden />
            <span>
              <strong>{t('settings.stoppedTitle')}</strong>
              <span>{t('settings.stoppedText', { code: stream.code })}</span>
            </span>
            <button type="button" className={styles.bannerAction} onClick={() => setRulesOpen(true)}>
              {t('offers.rules')}
              <ChevronRight aria-hidden />
            </button>
          </div>
          <div className={styles.compactLink}>
            <strong>{stream.code}</strong>
            <StatusBadge family="stream" code="STOPPED" />
            <span>{stream.productName}</span>
            <StreamLinkBox link={stream.link} size="md" />
            <CopyLinkButton link={stream.link} size="md" />
          </div>
        </>
      ) : (
        <StreamReadyPanel stream={stream} variant="settings" fee={feeAt(offer, stream.salePrice)} deliveryFee={offer.centerDeliveryFee} subtitle={subtitle} />
      )}

      {update.isError ? (
        <div className={styles.saveError} role="alert">
          <CircleX aria-hidden />
          <span>
            <strong>{t('settings.saveFailed')}</strong>
            <span>{t('settings.saveFailedText')}</span>
          </span>
          <button type="button" className={styles.bannerAction} onClick={() => save()}>
            {t('loadError.retry')}
            <RefreshCw aria-hidden />
          </button>
        </div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.form}>
          <section className={styles.card} aria-labelledby={`${ids}-tpl`}>
            <div className={styles.cardHead}>
              <h2 id={`${ids}-tpl`}>{t('settings.template')}</h2>
              <span>{t('settings.templateHint')}</span>
            </div>
            <div className={styles.templates} role="radiogroup" aria-labelledby={`${ids}-tpl`}>
              {TEMPLATES.map(({ value, icon: Icon, hint }) => (
                <label key={value} className={styles.template} data-checked={form.template === value || undefined} data-disabled={readOnly || undefined}>
                  <input type="radio" name={`${ids}-template`} value={value} checked={form.template === value} disabled={readOnly} onChange={() => set({ template: value })} className={styles.visuallyHidden} />
                  <span className={styles.radio} aria-hidden />
                  <span className={styles.mini} aria-hidden>
                    <span><Icon /></span>
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className={styles.templateText}>
                    <span>{t(`streams.template.${value}` as TranslationKey)}</span>
                    <span>{t(hint)}</span>
                    <button type="button" className={styles.previewLink} onClick={(event) => { event.preventDefault(); setPreview(value); }}>
                      <Eye aria-hidden />
                      {t('offer.preview')}
                    </button>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <PriceCard offer={offer} price={form.price} onChange={(price) => set({ price })} readOnly={readOnly} />

          <section className={styles.card} aria-labelledby={`${ids}-sub`}>
            <div className={styles.cardHead}>
              <h2 id={`${ids}-sub`}>{t('settings.subs')}</h2>
              <span>{t('settings.subsHint')}</span>
            </div>
            <div className={styles.subs}>
              {SUB_KEYS.map((key) => (
                <div key={key} className={styles.sub}>
                  <label htmlFor={`${ids}-${key}`} className={styles.fieldLabel}>{key}</label>
                  <input
                    id={`${ids}-${key}`}
                    className={styles.input}
                    placeholder={t('settings.empty')}
                    maxLength={255}
                    value={form.subs[key]}
                    disabled={readOnly}
                    onChange={(event) => set({ subs: { ...form.subs, [key]: event.target.value } })}
                  />
                </div>
              ))}
            </div>
            <div>
              <span className={styles.fieldLabel} id={`${ids}-subLink`}>{t('settings.linkWithSubs')}</span>
              <div className={styles.subLink}>
                <output className={styles.readonlyField} aria-labelledby={`${ids}-subLink`}>{linkWithSubs(stream.link, form.subs).replace(/^https?:\/\//, '')}</output>
                <CopyLinkButton link={linkWithSubs(stream.link, form.subs)} size="md" tone="plain" />
              </div>
              <p className={styles.fieldHint}>{t('settings.subsNote')}</p>
            </div>
          </section>

          <section className={styles.card} aria-labelledby={`${ids}-px`}>
            <div className={styles.cardHead}>
              <h2 id={`${ids}-px`}>{t('settings.pixels')}</h2>
              <span>{t('settings.pixelsHint')}</span>
            </div>
            <div className={styles.pixels}>
              <div>
                <label htmlFor={`${ids}-meta`} className={styles.fieldLabel}>{t('settings.metaPixel')}</label>
                <input
                  id={`${ids}-meta`}
                  className={styles.input}
                  inputMode="numeric"
                  placeholder={t('settings.notSet')}
                  maxLength={64}
                  value={form.metaPixelId}
                  disabled={readOnly}
                  aria-invalid={pixels.meta || undefined}
                  onChange={(event) => set({ metaPixelId: event.target.value })}
                />
                <p className={pixels.meta ? styles.fieldError : styles.fieldHint}>{t(pixels.meta ? 'settings.metaPixelError' : 'settings.metaPixelHint')}</p>
              </div>
              <div>
                <label htmlFor={`${ids}-tiktok`} className={styles.fieldLabel}>{t('settings.tiktokPixel')}</label>
                <input
                  id={`${ids}-tiktok`}
                  className={styles.input}
                  placeholder={t('settings.notSet')}
                  maxLength={64}
                  value={form.tiktokPixelId}
                  disabled={readOnly}
                  aria-invalid={pixels.tiktok || undefined}
                  onChange={(event) => set({ tiktokPixelId: event.target.value })}
                />
                <p className={pixels.tiktok ? styles.fieldError : styles.fieldHint}>{t(pixels.tiktok ? 'settings.tiktokPixelError' : 'settings.tiktokPixelHint')}</p>
              </div>
            </div>
          </section>
        </div>

        <ChangesCard
          offer={offer}
          savedPrice={stream.salePrice}
          price={form.price}
          dirty={dirty}
          invalid={invalid}
          saving={update.isPending}
          justSaved={savedAt !== null}
          readOnly={readOnly}
          onSave={() => save()}
          onReset={reset}
          phone={phone}
        />
      </div>

      {dirty || update.isPending ? (
        <PageActionBar>
          <button type="button" className={styles.barReset} onClick={reset} disabled={update.isPending}>{t('offer.cancel')}</button>
          <button type="button" className={styles.barSave} onClick={() => save()} disabled={invalid || update.isPending}>
            {update.isPending ? t('settings.saving') : t('settings.save')}
          </button>
        </PageActionBar>
      ) : null}

      {preview ? (
        <TemplatePreviewDialog
          open
          onClose={() => setPreview(null)}
          initial={preview}
          product={offer}
          price={priceBad ? stream.salePrice : (form.price ?? stream.salePrice)}
          centerFee={offer.centerDeliveryFee}
          doorFee={offer.addressDeliveryFee}
          onChoose={readOnly ? undefined : (template) => {
            set({ template });
            setPreview(null);
          }}
        />
      ) : null}

      <Dialog
        open={guard.pending !== null}
        onClose={guard.stay}
        title={t('settings.leaveTitle')}
        description={t('settings.leaveText')}
        icon={<TriangleAlert />}
        tone="warning"
        width={500}
        footer={
          <>
            <button type="button" className={styles.leaveDanger} onClick={guard.leave}>{t('settings.leaveWithout')}</button>
            <DialogCancel onClick={guard.stay}>{t('settings.stay')}</DialogCancel>
            <DialogPrimary shortcut={false} disabled={invalid} saving={update.isPending} savingLabel={t('settings.saving')} onClick={() => save(guard.leave)}>
              {t('settings.saveAndLeave')}
            </DialogPrimary>
          </>
        }
      >
        <div className={styles.leaveBox}>
          <span>{t('settings.leaveUnsaved')}</span>
          <span>{changeSummary(t, stream, form, offer)}</span>
        </div>
        <p className={styles.leaveNote}>{t('settings.leaveKeep', { price: t('affiliateHome.sum', { amount: formatMoneyNbsp(stream.salePrice) }), fee: t('affiliateHome.sum', { amount: formatMoneyNbsp(feeAt(offer, stream.salePrice)) }) })}</p>
      </Dialog>
      <AdRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

/** Saqlanmagan o'zgarishlar qisqacha: «Narx: 262 000 → 287 000 so‘m · haqingiz 65 000 → 86 250», shablon, sub, piksel. */
function changeSummary(t: ReturnType<typeof useTranslation>['t'], stream: AffiliateStream, form: StreamForm, offer: PricedOffer): string {
  const patch = formPatch(stream, form);
  const parts: string[] = [];
  if (patch.salePrice !== undefined) {
    parts.push(t('settings.leavePrice', {
      from: formatMoney(stream.salePrice),
      to: formatMoney(patch.salePrice),
      feeFrom: formatMoney(feeAt(offer, stream.salePrice)),
      feeTo: formatMoney(feeAt(offer, patch.salePrice)),
    }));
  }
  if (patch.template) parts.push(t('settings.leaveTemplate', { template: t(`streams.template.${patch.template}` as TranslationKey) }));
  if (SUB_KEYS.some((key) => patch[key] !== undefined)) parts.push(t('settings.subs'));
  if (patch.metaPixelId !== undefined || patch.tiktokPixelId !== undefined) parts.push(t('settings.pixels'));
  return parts.join(' · ');
}
