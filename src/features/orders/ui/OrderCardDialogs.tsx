import { App } from 'antd';
import { ChevronDown, CircleAlert, CircleCheck, Flag, ImagePlus, Info, Lock, MapPin, MessageSquare, RefreshCw, Send, Undo2, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useAdminLeadQuery } from '../../adminLeads/api/adminLeadsQueries';
import { useRegionTree } from '../../address/api/regionsQueries';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { dayTime, shortTime } from '../../../shared/lib/dayTime';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { tashkentDateTime, tashkentDay } from '../../../shared/lib/tashkentTime';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { useChangeAddressMutation, useCloseRequestMutation, useDisputeMutation, useOrderQuery, useRecordReturnMutation, useResendSmsMutation, useResendToElchiMutation } from '../api/ordersQueries';
import { isCancelable } from '../lib/orderStatus';
import { orderNumber, placeLine, statusLine } from '../lib/orderView';
import { uploadReturnPhotos } from '../api/ordersApi';
import type { CustomerRequestRow, OrderDetail, OrderRole } from '../model/orderTypes';
import styles from './OrderDialogs.module.css';

const TEXT_MAX = 500;
const PHOTO_MAX = 3;
const PHOTO_BYTES = 5 * 1024 * 1024;

interface CardDialogProps {
  order: OrderDetail;
  onClose: () => void;
}

const numberOf = (order: OrderDetail) => order.lead?.leadId ?? order.id;
const productOf = (order: OrderDetail) => order.sellerOrders[0]?.items[0]?.productName ?? order.product?.name ?? '—';

/** Toast — telefonda yuqorida, desktopda o'ng pastda (komponentlar-E R10). */
function useToast() {
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const placement = phone ? 'top' : 'bottomRight';
  return {
    success: (title: string, description: string) => notification.success({ title, description, placement, duration: 5 }),
    error: (title: string, error: unknown) => notification.error({ title, description: getApiErrorMessage(error), placement }),
  };
}

/** Majburiy matn maydoni (sabab, izoh): yozilmasa — maydon xatosi. */
function TextField({ label, value, onChange, error, placeholder, autoFocus = false }: { label: string; value: string; onChange: (value: string) => void; error: string | null; placeholder?: string; autoFocus?: boolean }) {
  const id = useId();
  const errorId = useId();
  return (
    <div>
      <div className={styles.labelRow}><label htmlFor={id}>{label} <span className={styles.required} aria-hidden>*</span></label></div>
      <textarea
        id={id}
        className={styles.textarea}
        value={value}
        maxLength={TEXT_MAX}
        required
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p id={errorId} className={styles.error}><CircleAlert aria-hidden />{error}</p> : null}
    </div>
  );
}

/** Ma'lumotnomada hali yo'q ro'yxat (kanal, sabab): yopiq tanlov va izoh. */
function PendingSelect({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const id = useId();
  return (
    <div>
      <div className={styles.labelRow}><label htmlFor={id}>{label}</label></div>
      <span className={styles.select}>
        <select id={id} disabled defaultValue=""><option value="">{value}</option></select>
        <ChevronDown aria-hidden />
      </span>
      {hint ? <p className={styles.fieldHint}>{hint}</p> : null}
    </div>
  );
}

const Facts = ({ rows }: { rows: ReadonlyArray<[string, ReactNode, ReactNode?]> }) => (
  <dl className={styles.facts}>
    {rows.map(([label, value, note]) => <div key={label}><dt>{label}</dt><dd>{value}{note ? <span className={styles.note}>{note}</span> : null}</dd></div>)}
  </dl>
);

// ── Qaytarish so'rovi ───────────────────────────────────────────────────────

/** Rasm ko'rinishi: obyekt URL render paytida emas, xotirada yaratiladi va yopilganda bo'shatiladi. */
function PhotoThumb({ file, onRemove, removeLabel }: { file: File; onRemove: () => void; removeLabel: string }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <span className={styles.photo}>
      <img src={url} alt={file.name} />
      <button type="button" aria-label={removeLabel} onClick={onRemove}><X aria-hidden /></button>
    </span>
  );
}

/**
 * «Qaytarish so'rovini qayd etish» (faqat «Yetkazildi»; backend `POST /admin/orders/{id}/returns`, sabab — `OTHER` + izoh).
 * Kanal ro'yxati — 8-savol (yopiq). Rasmlar ixtiyoriy — taklif `POST /admin/orders/{id}/returns/photos`.
 */
export function ReturnDialog({ order, onClose }: CardDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useRecordReturnMutation();
  const fileId = useId();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const number = numberOf(order);
  const delivered = order.lead?.statusHistory.find((entry) => entry.accepted && entry.toStatus === 'DELIVERED')?.createdAt ?? null;
  const entries = order.money?.entries.length ?? 0;
  const trimmed = text.trim();

  const addPhotos = (files: FileList | null) => {
    const picked = [...(files ?? [])];
    const valid = picked.filter((file) => file.type.startsWith('image/') && file.size <= PHOTO_BYTES);
    setPhotoError(valid.length < picked.length ? t('ordc.ret.photoInvalid') : null);
    setPhotos((current) => [...current, ...valid].slice(0, PHOTO_MAX));
  };

  const submit = () => {
    setTried(true);
    if (!trimmed) return;
    const items = order.sellerOrders.flatMap((seller) => seller.items.map((item) => ({ productId: item.productId, quantity: item.quantity })));
    // Rasmlar so'rov yaratilgach yuklanadi; yuklanmasa ham so'rov qayd etilgan — alohida ogohlantirish.
    const finish = async () => {
      if (photos.length) await uploadReturnPhotos({ id: order.id, files: photos }).catch((error: unknown) => toast.error(t('ordc.ret.photoFailed'), error));
      toast.success(t('ordc.ret.done'), t('ordc.ret.doneText', { id: number }));
      onClose();
    };
    save.mutate({ id: order.id, reason: 'OTHER', comment: trimmed, items }, {
      onSuccess: () => void finish(),
      onError: (error) => toast.error(t('ordc.ret.error'), error),
    });
  };

  return (
    <Dialog
      open
      title={t('ordc.ret.title', { id: number })}
      description={[order.buyerName, productOf(order), t('ord.sum', { amount: formatMoney(order.totalAmount) })].join(' · ')}
      icon={<Undo2 />}
      locked={save.isPending}
      onClose={onClose}
      testId="order-return-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={save.isPending}>{t('ordc.dlg.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={save.isPending} savingLabel={t('ordc.dlg.saving')} shortcut={false} icon={<Undo2 />}>{t('ordc.ret.submit')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.body}>
        <div className={styles.box}>
          <Facts rows={[
            [t('status.order.DELIVERED'), delivered ? tashkentDateTime(delivered) : '—'],
            [t('ordc.ret.until'), order.money?.returnUntil ? tashkentDateTime(order.money.returnUntil) : <span className={styles.muted}>{t('ordc.pending')}</span>],
            [t('ordc.ret.money'), order.money?.state ? t('ordc.ret.moneyValue', { state: t(`ordc.money.${order.money.state}`).toLowerCase(), count: entries }) : '—'],
          ]} />
        </div>
        <PendingSelect label={t('ordc.ret.channel')} value={t('ordc.ret.channelPending')} />
        <TextField label={t('ordc.ret.reason')} value={text} onChange={setText} error={tried && !trimmed ? t('ordc.ret.reasonError') : null} placeholder={t('ordc.ret.reasonPlaceholder')} autoFocus />
        <div>
          <div className={styles.labelRow}><span className={styles.labelText}>{t('ordc.ret.photos')}</span><span className={styles.optional}>{t('ordc.optional')}</span></div>
          <div className={styles.photos}>
            {photos.map((file, index) => <PhotoThumb key={`${file.name}-${index}`} file={file} removeLabel={t('ordc.ret.photoRemove', { name: file.name })} onRemove={() => setPhotos((current) => current.filter((_, position) => position !== index))} />)}
            {photos.length < PHOTO_MAX ? (
              <label htmlFor={fileId} className={styles.smallButton}>
                <ImagePlus aria-hidden />{t('ordc.ret.addPhoto')}
                <input id={fileId} type="file" accept="image/*" multiple className={styles.visuallyHidden} onChange={(event) => { addPhotos(event.target.files); event.target.value = ''; }} />
              </label>
            ) : null}
          </div>
          {photoError ? <p className={styles.error}><CircleAlert aria-hidden />{photoError}</p> : <p className={styles.fieldHint}>{t('ordc.ret.photoHint', { count: PHOTO_MAX })}</p>}
        </div>
        <div className={styles.box}>
          <p className={styles.boxTitle}>{t('ordc.ret.after')}</p>
          <Facts rows={[
            [t('ord.cancel.status'), <StatusBadge key="status" family="order" code="RETURN_REQUESTED" />],
            [t('ordc.ret.entries'), t('ordc.ret.entriesValue')],
          ]} />
        </div>
      </div>
    </Dialog>
  );
}

// ── Nizoli ──────────────────────────────────────────────────────────────────

/** «Nizoli deb belgilash»: qo'ng'iroq yozuvi 1 yil saqlanadi (oddiy — 90 kun); belgi audit jurnaliga yoziladi. */
export function DisputeDialog({ order, onClose }: CardDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useDisputeMutation();
  const leadId = order.lead?.leadId ?? '';
  const lead = useAdminLeadQuery(leadId).data;
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const number = numberOf(order);
  const trimmed = text.trim();
  const [openedAt] = useState(() => Date.now());
  const keepUntil = tashkentDay(openedAt + 365 * 24 * 60 * 60_000);
  const recordings = (lead?.attemptLog ?? []).filter((attempt) => attempt.recording === 'READY');

  const submit = () => {
    setTried(true);
    if (!trimmed) return;
    save.mutate({ id: order.id, reason: trimmed }, {
      onSuccess: () => {
        toast.success(t('ordc.dis.done'), t('ordc.dis.doneText', { id: number, date: keepUntil }));
        onClose();
      },
      onError: (error) => toast.error(t('ordc.dis.error'), error),
    });
  };

  return (
    <Dialog
      open
      title={t('ordc.a.dispute')}
      description={t('ordc.dis.description')}
      icon={<Flag />}
      tone="warning"
      locked={save.isPending}
      onClose={onClose}
      testId="order-dispute-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={save.isPending}>{t('ordc.dlg.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={save.isPending} savingLabel={t('ordc.dlg.saving')} shortcut={false} icon={<Flag />}>{t('ordc.a.dispute')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.body}>
        <div className={styles.box}>
          <Facts rows={[
            [t('ord.cancel.order'), `${number} · ${order.buyerName}`],
            [t('ord.cancel.status'), <StatusBadge key="status" family="order" code={order.status} />],
            [t('ordc.dis.records'), recordings.length ? t('ordc.dis.recordsValue', { count: recordings.length, when: tashkentDateTime(recordings.at(-1)?.at ?? order.createdAt) }) : t('ordc.dis.recordsNone')],
          ]} />
        </div>
        <TextField label={t('ordc.ret.reason')} value={text} onChange={setText} error={tried && !trimmed ? t('ordc.dis.reasonError') : null} placeholder={t('ordc.dis.placeholder')} autoFocus />
        <p className={styles.hint}><Info aria-hidden />{t('ordc.dis.keep', { date: keepUntil })}</p>
      </div>
    </Dialog>
  );
}

// ── Elchi'ga qayta yuborish ─────────────────────────────────────────────────

/** Posilka so'rovi navbatdan hoziroq; buyurtma raqami bo'yicha bir marta bajariladi — ikkinchi posilka yaratilmaydi. */
export function ResendDialog({ order, onClose }: CardDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useResendToElchiMutation();
  const number = numberOf(order);
  const failed = (order.parcel?.attempts ?? []).filter((attempt) => attempt.state === 'FAILED');
  const lastAt = failed.at(-1)?.at ?? null;

  const submit = () => save.mutate({ id: order.id }, {
    onSuccess: () => {
      toast.success(t('ordc.rs.done'), t('ordc.rs.doneText', { id: number }));
      onClose();
    },
    onError: (error) => toast.error(t('ordc.rs.error'), error),
  });

  return (
    <Dialog
      open
      title={t('ordc.a.resend')}
      description={t('ordc.rs.description')}
      icon={<Send />}
      locked={save.isPending}
      onClose={onClose}
      testId="order-resend-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={save.isPending}>{t('ordc.dlg.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={save.isPending} savingLabel={t('ordc.dlg.saving')} shortcut={false} icon={<RefreshCw />}>{t('ordc.rs.submit')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.body}>
        <div className={styles.box}>
          <Facts rows={[
            [t('ord.cancel.order'), [number, order.buyerName, order.parcel?.act ? t('ordc.rs.act', { code: order.parcel.act.code }) : null].filter(Boolean).join(' · ')],
            [t('ordc.rs.attempts'), failed.length ? t('ordc.rs.attemptsValue', { count: failed.length, time: lastAt ? shortTime(lastAt) : '—' }) : '—'],
            [t('ordc.rs.api'), <span key="api" className={styles.muted}>{t('ordc.pending')}</span>],
          ]} />
        </div>
        <p className={styles.hint}><Info aria-hidden />{t('ordc.rs.once')}</p>
        <p className={styles.hint}><RefreshCw aria-hidden />{t('ordc.rs.queue')}</p>
      </div>
    </Dialog>
  );
}

// ── Manzilni tuzatish ───────────────────────────────────────────────────────

/**
 * Manzil Elchi'ga topshirilgunga qadar tuzatiladi (taklif `PATCH /admin/orders/{id}/address`): viloyat, tuman,
 * yetkazish turi, izoh majburiy. Yetkazish narxi o'zgaradi; narx qatorlari muhrlangan.
 */
export function AddressDialog({ order, request = null, onClose, onDone }: CardDialogProps & { request?: CustomerRequestRow | null; onDone?: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useChangeAddressMutation();
  const regions = useRegionTree().data ?? [];
  const regionId = useId();
  const districtId = useId();
  const districtErrorId = useId();
  // Mijoz so'rovi bo'yicha — so'ralgan tuman va yetkazish turi oldindan tanlangan, izoh — so'rov manbai bilan.
  const [regionSoato, setRegion] = useState(request?.regionSoato ?? order.lead?.regionSoato ?? '');
  const [districtSoato, setDistrict] = useState(request?.districtSoato ?? order.lead?.districtSoato ?? '');
  const [where, setWhere] = useState(request?.whereDeliver ?? order.lead?.whereDeliver ?? 'CENTER');
  const [text, setText] = useState(request ? t('ordc.ad.fromRequest', { time: shortTime(request.createdAt) }) : '');
  const [tried, setTried] = useState(false);
  const number = numberOf(order);
  const pricing = order.pricing ?? null;
  const fee = (value: 'CENTER' | 'ADDRESS') => (value === 'ADDRESS' ? pricing?.visibleAddress : pricing?.visibleCenter) ?? order.deliveryFee;
  const tariff = (value: 'CENTER' | 'ADDRESS') => (value === 'ADDRESS' ? 60_000 : 40_000);
  const districts = regions.find((region) => region.satoCode === regionSoato)?.districts ?? [];
  const goods = order.totalAmount - order.deliveryFee;
  const currentWhere = order.lead?.whereDeliver ?? 'CENTER';
  const trimmed = text.trim();
  const changed = !districtSoato || districtSoato !== order.lead?.districtSoato || where !== currentWhere;

  const submit = () => {
    setTried(true);
    if (!trimmed || !districtSoato) return;
    save.mutate({ id: order.id, regionSoato, districtSoato, addressLine: order.customer?.addressLine ?? '', whereDeliver: where, reason: trimmed }, {
      onSuccess: () => {
        const district = districts.find((item) => item.satoCode === districtSoato)?.name ?? '';
        if (request) toast.success(t('ordc.ad.doneRequestTitle', { id: number }), t('ordc.ad.doneRequest', { place: district, where: t(`opw.whereDeliver.${where}`), total: formatMoney(goods + fee(where)) }));
        else toast.success(t('ordc.ad.done'), t('ordc.ad.doneText', { id: number }));
        onDone?.();
        onClose();
      },
      onError: (error) => toast.error(t('ordc.ad.error'), error),
    });
  };

  return (
    <Dialog
      open
      title={t('ordc.ad.title', { id: number })}
      description={[order.buyerName, t(`status.order.${order.status}`), order.statusDetail].filter(Boolean).join(' · ')}
      icon={<MapPin />}
      locked={save.isPending}
      onClose={onClose}
      testId="order-address-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={save.isPending}>{t('ordc.dlg.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={save.isPending} savingLabel={t('ordc.dlg.saving')} shortcut={false} disabled={!changed}>{t('ordc.dlg.save')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.body}>
        <p className={styles.hint}>
          <Info aria-hidden />
          {request
            ? t('ordc.ad.hintRequest', { when: dayTime(request.createdAt, t, undefined, true), wanted: `${request.districtName ?? '—'}, ${request.whereDeliver ? t(`opw.whereDeliver.${request.whereDeliver}`) : '—'}`, place: [order.customer?.regionName, order.customer?.districtName].filter(Boolean).join(', '), where: t(`opw.whereDeliver.${currentWhere}`) })
            : t('ordc.ad.hint', { place: [order.customer?.regionName, order.customer?.districtName].filter(Boolean).join(', '), where: t(`opw.whereDeliver.${currentWhere}`) })}
        </p>
        <div className={styles.row}>
          <div>
            <div className={styles.labelRow}><label htmlFor={regionId}>{t('ordc.ad.region')}</label></div>
            <span className={styles.select} data-active>
              <select id={regionId} value={regionSoato} onChange={(event) => { setRegion(event.target.value); setDistrict(''); }}>
                {regions.map((region) => <option key={region.satoCode} value={region.satoCode}>{region.name}</option>)}
              </select>
              <ChevronDown aria-hidden />
            </span>
          </div>
          <div>
            <div className={styles.labelRow}><label htmlFor={districtId}>{t('ordc.ad.district')}</label></div>
            <span className={styles.select} data-active>
              <select id={districtId} value={districtSoato} aria-invalid={tried && !districtSoato ? true : undefined} aria-describedby={tried && !districtSoato ? districtErrorId : undefined} onChange={(event) => setDistrict(event.target.value)}>
                <option value="" disabled>{t('ordc.ad.pick')}</option>
                {districts.map((district) => <option key={district.satoCode} value={district.satoCode}>{district.name}</option>)}
              </select>
              <ChevronDown aria-hidden />
            </span>
            {tried && !districtSoato ? <p id={districtErrorId} className={styles.error}><CircleAlert aria-hidden />{t('ordc.ad.districtError')}</p> : null}
          </div>
        </div>
        <div className={styles.choices} role="radiogroup" aria-label={t('ordc.c.where')}>
          {(['CENTER', 'ADDRESS'] as const).map((value) => (
            <button key={value} type="button" role="radio" aria-checked={where === value} className={styles.choice} onClick={() => setWhere(value)}>
              {t('ordc.ad.option', { where: t(`ord.where.${value}`), fee: formatMoney(fee(value)) })}
            </button>
          ))}
        </div>
        <TextField label={t('ord.cancel.comment')} value={text} onChange={setText} error={tried && !trimmed ? t('ordc.ad.reasonError') : null} placeholder={t('ordc.ad.placeholder')} />
        <div className={styles.box}>
          <p className={styles.boxTitle}>{t('ordc.ad.after')}</p>
          <Facts rows={[
            [t('ordc.p.total'), where === currentWhere ? t('ord.sum', { amount: formatMoney(order.totalAmount) }) : t('ordc.ad.change', { from: formatMoney(order.totalAmount), to: formatMoney(goods + fee(where)) })],
            [t('ordc.p.tariff'), where === currentWhere ? formatMoney(tariff(currentWhere)) : t('ordc.ad.change', { from: formatMoney(tariff(currentWhere)), to: formatMoney(tariff(where)) })],
            [t('ordc.ad.lines'), t('ordc.ad.linesValue')],
            ...(request ? [[t('ordc.e.label'), t(order.parcel?.label ? 'ordc.ad.labelReprint' : 'ordc.ad.labelNew')] as [string, string]] : []),
          ]} />
        </div>
      </div>
    </Dialog>
  );
}

// ── SMS ni qayta yuborish ───────────────────────────────────────────────────

/** Avtomatik SMS bir buyurtmaga bir marta boradi; qo'lda qayta yuborish audit jurnaliga (taklif). «Yetkazildi» — 11-qaror. */
export function SmsDialog({ order, onClose }: CardDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useResendSmsMutation();
  const groupId = useId();
  const sent = (order.sms ?? []).filter((item) => item.state === 'SENT');
  const [picked, setPicked] = useState(sent.at(-1)?.title ?? '');
  const number = numberOf(order);

  const submit = () => save.mutate({ id: order.id, template: picked }, {
    onSuccess: () => {
      toast.success(t('ordc.sm.done'), t('ordc.sm.doneText', { id: number, title: picked }));
      onClose();
    },
    onError: (error) => toast.error(t('ordc.sm.error'), error),
  });

  return (
    <Dialog
      open
      title={t('ordc.sm.title')}
      description={t('ordc.sm.description', { id: number })}
      icon={<MessageSquare />}
      locked={save.isPending}
      onClose={onClose}
      testId="order-sms-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={save.isPending}>{t('ordc.dlg.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={save.isPending} savingLabel={t('ordc.dlg.saving')} shortcut={false} icon={<Send />} disabled={!picked}>{t('ordc.sm.submit')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.body}>
        <div className={styles.box}>
          <Facts rows={[
            [t('ordc.sm.to'), `${order.phoneMasked ?? '—'} · ${order.buyerName}`],
            [t('ordc.sm.text'), t('ordc.sm.textValue', { amount: formatMoney(order.totalAmount) })],
          ]} />
        </div>
        <fieldset className={styles.radios} aria-describedby={groupId}>
          <legend>{t('ordc.sm.which')}</legend>
          {sent.map((item) => (
            <label key={item.title} className={styles.radio}>
              <input type="radio" name="sms" value={item.title} checked={picked === item.title} onChange={() => setPicked(item.title)} />
              <span><span>{item.title}</span><span>{[item.at ? t('ordc.sm.sentAt', { when: dayTime(item.at, t, undefined, true) }) : null, item.detail].filter(Boolean).join(' · ')}</span></span>
            </label>
          ))}
          {['DELIVERED', 'REMITTED', 'SETTLED'].includes(order.status) ? (
            <label className={styles.radio} data-disabled>
              <input type="radio" name="sms" disabled />
              <span><span>{t('status.order.DELIVERED')}</span><span>{t('ordc.sms.deliveredPending')}</span></span>
            </label>
          ) : null}
        </fieldset>
        <p id={groupId} className={styles.hint}><Info aria-hidden />{t('ordc.sm.note')}</p>
      </div>
    </Dialog>
  );
}


/** Ro'yxatdan (nazoratchi): karta ma'lumoti yuklangach manzil oynasi ochiladi. */
export function AddressDialogFor({ orderId, role, request, onClose, onDone }: { orderId: string; role: OrderRole; request?: CustomerRequestRow | null; onClose: () => void; onDone?: () => void }) {
  const order = useOrderQuery(role, orderId).data;
  return order ? <AddressDialog order={order} request={request} onClose={onClose} onDone={onDone} /> : null;
}

// ── So'rovni yopish ─────────────────────────────────────────────────────────

/**
 * «So'rovni yopish» (taklif `POST /supervisor/order-requests/{id}/close {comment}`): so'rov bajarilmasdan yopiladi —
 * masalan, posilka Elchi'ga topshirilgan. Mijozga nima deyilgani majburiy: buyurtma tarixiga va so'rovga yoziladi.
 */
export function CloseRequestDialog({ request, onClose }: { request: CustomerRequestRow; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useCloseRequestMutation();
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const order = request.order ?? null;
  const number = order ? orderNumber(order) : request.orderId;
  const late = order ? !isCancelable(order.status) : false;
  const trimmed = text.trim();
  const line = order ? statusLine(order, t) : null;

  const submit = () => {
    setTried(true);
    if (!trimmed) return;
    save.mutate({ id: request.id, comment: trimmed }, {
      onSuccess: () => {
        toast.success(t('ord.req.closedDone'), t('ord.req.closedDoneText', { id: number }));
        onClose();
      },
      onError: (error) => toast.error(t('ord.req.closeError'), error),
    });
  };

  return (
    <Dialog
      open
      title={t('ord.req.close')}
      description={[number, order?.buyerName, late ? t('ord.req.notDone') : null].filter(Boolean).join(' · ')}
      icon={<CircleCheck />}
      locked={save.isPending}
      onClose={onClose}
      testId="close-request-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={save.isPending}>{t('ordc.dlg.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={save.isPending} savingLabel={t('ordc.dlg.saving')} shortcut={false}>{t('ord.req.close')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.body}>
        <div className={styles.box}>
          <Facts rows={[
            [t('ord.req.request'), t('ord.req.requestValue', { kind: t(request.kind === 'CANCEL' ? 'ord.req.kindCancelShort' : 'ord.req.kindAddressShort'), when: dayTime(request.createdAt, t, undefined, true) }), request.comment ? `«${request.comment}»` : null],
            [t('ord.cancel.order'), [number, order?.buyerName, order ? placeLine(order) : null].filter(Boolean).join(' · '), line],
          ]} />
        </div>
        {late ? (
          <div className={styles.danger} role="note">
            <Lock aria-hidden />
            <div><p>{t('ord.req.cannotCancel')}</p><p>{t('ord.req.cannotCancelText')}</p></div>
          </div>
        ) : null}
        <TextField label={t('ord.req.answerLabel')} value={text} onChange={setText} error={tried && !trimmed ? t('ord.req.answerError') : null} placeholder={t('ord.req.answerPlaceholder')} autoFocus />
        <p className={styles.fieldHint}>{t('ord.req.answerHint')}</p>
      </div>
    </Dialog>
  );
}
