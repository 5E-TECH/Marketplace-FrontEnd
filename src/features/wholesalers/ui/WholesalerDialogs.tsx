import { App } from 'antd';
import { ChevronDown, ChevronRight, CirclePause, CirclePlay, ClipboardCheck, FileText, FileUp, Landmark, Lock, Send, TriangleAlert } from 'lucide-react';
import { useId, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { formatCsvDate } from '../../../shared/lib/csv';
import { useMediaQuery } from '../../../shared/lib/useMediaQuery';
import { DateInput } from '../../../shared/ui/DateInput/DateInput';
import { Dialog, DialogCancel, DialogPrimary } from '../../../shared/ui/Dialog/Dialog';
import { formatMoney } from '../../../shared/ui/MoneyText/formatMoney';
import {
  useInviteOwnerMutation,
  useReviewBankChangeMutation,
  useReviewWholesalerMutation,
  useSendActMutation,
  useUpdateWholesalerMutation,
  useUploadContractMutation,
  useWholesalerActsQuery,
} from '../api/wholesalersQueries';
import type { ActChannel } from '../api/wholesalersApi';
import { cabinetState, checkContractFile, displayPhone, type ContractFileError } from '../lib/wholesalerRules';
import type { Wholesaler, WholesalerAct } from '../model/wholesalerTypes';
import { ContractFile } from './ContractFile';
import styles from './WholesalerUi.module.css';

type T = ReturnType<typeof useTranslation>['t'];


function useToast() {
  const { notification } = App.useApp();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const placement = phone ? 'top' as const : 'bottomRight' as const;
  return {
    success: (title: string, description?: string) => notification.success({ title, description, placement, duration: 5 }),
    info: (title: string, description?: string) => notification.info({ title, description, placement, duration: 5 }),
    error: (title: string, error: unknown) => notification.error({ title, description: getApiErrorMessage(error), placement }),
  };
}

interface DialogProps {
  wholesaler: Wholesaler;
  onClose: () => void;
}

/**
 * «Shartnoma nusxasini yuklash» (holatlar §5): skan + raqami va imzolangan sanasi (OPT-1; kartada raqam va sana
 * majburiy), versiya — EQ-10 kutilmoqda. Saqlangach mahsulot va postavka qo'shish ochiladi (taklif §3).
 */
export function ContractDialog({ wholesaler, initialFile = null, onClose }: DialogProps & { initialFile?: File | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const upload = useUploadContractMutation();
  const numberId = useId();
  const dateId = useId();
  const versionId = useId();
  const [file, setFile] = useState<File | null>(initialFile);
  const [number, setNumber] = useState(wholesaler.contractNumber ?? '');
  const [date, setDate] = useState<string | null>(wholesaler.contractDate ?? null);
  const [touched, setTouched] = useState(false);
  const fileError: ContractFileError | null = file ? checkContractFile(file) : touched ? 'required' : null;
  const numberMissing = touched && !number.trim();
  const dateMissing = touched && !date;

  const submit = () => {
    setTouched(true);
    if (!file || checkContractFile(file) || !number.trim() || !date || upload.isPending) return;
    upload.mutate({ id: wholesaler.id, file, contractNumber: number, contractDate: date }, {
      onSuccess: () => {
        toast.success(t('whd.contract.toast'), t('whd.contract.toastText', { name: wholesaler.name }));
        onClose();
      },
      onError: (error) => toast.error(t('whd.contract.error'), error),
    });
  };

  return (
    <Dialog
      open
      title={t('whd.contract.title')}
      description={t('whd.contract.sub', { name: wholesaler.name })}
      icon={<FileUp />}
      width={480}
      locked={upload.isPending}
      onClose={onClose}
      testId="contract-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={upload.isPending}>{t('whd.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={upload.isPending} savingLabel={t('whd.saving')} shortcut={false}>{t('whd.contract.save')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.stack}>
        <ContractFile file={file} onChange={setFile} phone={phone} error={fileError} label={t('whd.contract.fileLabel')} />
        <div className={styles.pair}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={numberId}>{t('whd.contract.number')} <span aria-hidden>*</span></label>
            <div className={styles.control} aria-invalid={numberMissing || undefined}>
              <input id={numberId} value={number} maxLength={64} placeholder="K-2027/014" onChange={(event) => setNumber(event.target.value)} aria-invalid={numberMissing || undefined} />
            </div>
            {numberMissing ? <p className={styles.error}>{t('whd.required')}</p> : null}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={dateId}>{t('whd.contract.date')} <span aria-hidden>*</span></label>
            <DateInput id={dateId} value={date} onChange={setDate} aria-invalid={dateMissing || undefined} />
            {dateMissing ? <p className={styles.error}>{t('whd.required')}</p> : null}
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={versionId}>{t('whd.contract.version')}</label>
          <div className={styles.control} data-disabled>
            <select id={versionId} disabled value=""><option value="">{t('whd.versionTbd')}</option></select>
            <ChevronDown aria-hidden />
          </div>
        </div>
        <p className={styles.note}>{t('whd.contract.note')}</p>
      </div>
    </Dialog>
  );
}

/**
 * «Kabinetga taklif yuborish» (M2, BE-30 `POST /admin/wholesalers/{id}/owner`): shu kartadagi telefonga SMS; optovik
 * SMS kod bilan kiradi va shartnomani elektron imzolaydi.
 */
export function InviteOwnerDialog({ wholesaler, onClose }: DialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const invite = useInviteOwnerMutation();
  const phoneNumber = displayPhone(wholesaler.phone);
  const submit = () => {
    if (!wholesaler.phone || invite.isPending) return;
    invite.mutate({ id: wholesaler.id, phone: wholesaler.phone, fullName: wholesaler.directorName?.trim() || wholesaler.name }, {
      onSuccess: () => {
        toast.success(t('whd.invite.toast'), t('whd.invite.toastText', { phone: phoneNumber }));
        onClose();
      },
      onError: (error) => toast.error(t('whd.invite.error'), error),
    });
  };
  const steps: [string, string][] = [
    [t('whd.invite.step1'), t('whd.invite.step1Text')],
    [t('whd.invite.step2'), t('whd.invite.step2Text')],
    [t('whd.invite.step3'), t('whd.invite.step3Text')],
  ];
  return (
    <Dialog
      open
      title={t('whd.invite.title')}
      description={t('whd.invite.sub')}
      icon={<Send />}
      locked={invite.isPending}
      onClose={onClose}
      testId="invite-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={invite.isPending}>{t('whd.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={invite.isPending} savingLabel={t('whd.sending')} icon={<Send />} shortcut={false} disabled={!wholesaler.phone}>{t('whd.invite.send')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.stack}>
        <dl className={styles.facts}>
          <div><dt>{t('whd.invite.phone')}</dt><dd>{phoneNumber}</dd></div>
          <div><dt>{t('whd.invite.company')}</dt><dd>{t('whd.invite.companyValue', { name: wholesaler.name, tin: wholesaler.tin ?? '—' })}</dd></div>
        </dl>
        <div className={styles.smsBox}>
          <p>{t('whd.invite.sms')}</p>
          <p><span className={styles.tbd}>{t('whd.brandTbd')}</span>{t('whd.invite.smsText')}<span className={styles.tbd}>{t('whd.linkTbd')}</span>{t('whd.invite.smsTail')}</p>
        </div>
        <ol className={styles.steps}>
          {steps.map(([title, text], index) => (
            <li key={title}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <span className={styles.stepBody}><span>{title}</span><span>{text}</span></span>
            </li>
          ))}
        </ol>
        <p className={styles.note}>{t('whd.invite.note')}</p>
      </div>
    </Dialog>
  );
}

/**
 * «Optovikni to'xtatish» — xavfli tasdiq (holatlar §5): oqibatlar (kabinet, sotuvdagi mahsulotlar, ombor, yo'lda,
 * to'lanadigan) va sabab majburiy (audit). BE-07 PATCH `status: SUSPENDED`; `reason` — taklif §1.
 */
export function SuspendDialog({ wholesaler, onClose }: DialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateWholesalerMutation();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = touched && !reason.trim();
  const stats = wholesaler.stats;
  const submit = () => {
    setTouched(true);
    if (!reason.trim() || update.isPending) return;
    update.mutate({ id: wholesaler.id, changes: { status: 'SUSPENDED', reason: reason.trim() } }, {
      onSuccess: () => {
        toast.success(t('whd.suspend.toast', { name: wholesaler.name }), t('whd.suspend.toastText'));
        onClose();
      },
      onError: (error) => toast.error(t('whd.suspend.error'), error),
    });
  };
  const effects: [string, string][] = [
    [t('whd.suspend.cabinet'), cabinetState(wholesaler) === 'NONE' ? t('whd.suspend.cabinetNone') : t('whd.suspend.cabinetText')],
    [t('whd.suspend.products', { count: stats?.products.onSale ?? 0 }), `${t('whd.suspend.productsText')} ${t('whd.tbd')}`],
    [t('whd.suspend.stock', { count: formatMoney(stats?.stock.onHand ?? 0) }), t('whd.suspend.stockText')],
    [t('whd.suspend.transit', { count: formatMoney(stats?.goods?.inTransit ?? 0) }), t('whd.suspend.transitText')],
    [t('whd.suspend.payable', { amount: formatMoney(stats?.payable.amount ?? 0) }), `${t('whd.suspend.payableText')} ${t('whd.tbd')}`],
  ];
  return (
    <Dialog
      open
      title={t('whd.suspend.title')}
      description={t('whd.suspend.sub', { name: wholesaler.name })}
      icon={<CirclePause />}
      tone="danger"
      locked={update.isPending}
      onClose={onClose}
      testId="suspend-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={update.isPending}>{t('whd.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={update.isPending} savingLabel={t('whd.saving')} icon={<CirclePause />} shortcut={false} danger>{t('whd.suspend.confirm')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.stack}>
        <ul className={styles.effects}>
          {effects.map(([title, text]) => (
            <li key={title}><ChevronRight aria-hidden /><span><span>{title}</span><span>{text}</span></span></li>
          ))}
        </ul>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={reasonId}>{t('whd.suspend.reason')}</label>
          <textarea
            id={reasonId}
            className={styles.textarea}
            value={reason}
            maxLength={500}
            placeholder={t('whd.suspend.reasonPlaceholder')}
            aria-invalid={missing || undefined}
            onChange={(event) => setReason(event.target.value)}
          />
          {missing ? <p className={styles.error}>{t('whd.suspend.reasonRequired')}</p> : null}
        </div>
        <p className={styles.note}>{t('whd.suspend.audit')}</p>
      </div>
    </Dialog>
  );
}

/** To'xtatilgan optovikni faollashtirish (BE-07 PATCH `status: ACTIVE`): kabinet ochiladi, postavka va mahsulot — yana. */
export function ResumeDialog({ wholesaler, onClose }: DialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateWholesalerMutation();
  const submit = () => {
    if (update.isPending) return;
    update.mutate({ id: wholesaler.id, changes: { status: 'ACTIVE' } }, {
      onSuccess: () => {
        toast.success(t('whd.resume.toast', { name: wholesaler.name }));
        onClose();
      },
      onError: (error) => toast.error(t('whd.resume.error'), error),
    });
  };
  return (
    <Dialog
      open
      title={t('whd.resume.title')}
      description={wholesaler.name}
      icon={<CirclePlay />}
      tone="success"
      locked={update.isPending}
      onClose={onClose}
      testId="resume-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={update.isPending}>{t('whd.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={update.isPending} savingLabel={t('whd.saving')} icon={<CirclePlay />} shortcut={false}>{t('whd.resume.confirm')}</DialogPrimary>
        </>
      )}
    >
      <p className={styles.note}>{t('whd.resume.text')}</p>
    </Dialog>
  );
}

const actTitle = (act: WholesalerAct, t: T) => t(`whd.act.kind.${act.kind}`, { code: act.code });

/**
 * «Aktni optovikka yuborish» (holatlar §5): brak akti, qabul (farq) akti yoki akt-sverka; kabinetga va/yoki chop
 * etib (tovar bilan birga). Kabineti yo'q optovikka qaysi kanal — [TZ'da yo'q — 26-savol]. Taklif §5.
 */
export function SendActDialog({ wholesaler, initialActId = null, onClose }: DialogProps & { initialActId?: string | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const acts = useWholesalerActsQuery(wholesaler.id);
  const send = useSendActMutation();
  const cabinet = cabinetState(wholesaler) === 'ACTIVE';
  const list = acts.data ?? [];
  const [selected, setSelected] = useState<string | null>(initialActId);
  const [channels, setChannels] = useState<Record<ActChannel, boolean>>({ CABINET: cabinet, PRINT: !cabinet });
  const actId = selected ?? list[0]?.id ?? null;
  const act = list.find((item) => item.id === actId) ?? null;
  const chosen = (Object.keys(channels) as ActChannel[]).filter((key) => channels[key]);
  const submit = () => {
    if (!act || !chosen.length || send.isPending) return;
    send.mutate({ id: wholesaler.id, actId: act.id, channels: chosen }, {
      onSuccess: () => {
        toast.info(t('whd.act.toast'), t(channels.CABINET ? 'whd.act.toastCabinet' : 'whd.act.toastPrint', { code: act.code, name: wholesaler.name }));
        if (channels.PRINT) window.print();
        onClose();
      },
      onError: (error) => toast.error(t('whd.act.error'), error),
    });
  };
  return (
    <Dialog
      open
      title={t('whd.act.title')}
      description={t(cabinet ? 'whd.act.subCabinet' : 'whd.act.subNoCabinet', { name: wholesaler.name })}
      icon={<Send />}
      locked={send.isPending}
      onClose={onClose}
      testId="act-dialog"
      footer={(
        <>
          <DialogCancel onClick={onClose} disabled={send.isPending}>{t('whd.cancel')}</DialogCancel>
          <DialogPrimary onClick={submit} saving={send.isPending} savingLabel={t('whd.sending')} icon={<Send />} shortcut={false} disabled={!act || !chosen.length}>{t('whd.act.send')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.stack}>
        <div>
          <p className={styles.groupLabel} id="whd-act-list">{t('whd.act.which')}</p>
          {acts.isPending ? <p className={styles.note}>{t('whs.loading')}</p> : list.length ? (
            <div className={styles.options} role="radiogroup" aria-labelledby="whd-act-list">
              {list.map((item) => (
                <label key={item.id} className={styles.option} data-checked={item.id === actId || undefined}>
                  <input type="radio" name="whd-act" checked={item.id === actId} onChange={() => setSelected(item.id)} />
                  <span>
                    <span>{actTitle(item, t)}</span>
                    <span>{item.title}{item.at && item.kind !== 'SETTLEMENT' ? ` · ${formatCsvDate(item.at)}` : ''}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : <p className={styles.note}>{t('whd.act.none')}</p>}
        </div>
        <div>
          <p className={styles.groupLabel}>{t('whd.act.how')}</p>
          <div className={styles.checks}>
            {(['CABINET', 'PRINT'] as const).map((key) => (
              <label key={key} className={styles.check}>
                <input type="checkbox" checked={channels[key]} disabled={key === 'CABINET' && !cabinet} onChange={(event) => setChannels({ ...channels, [key]: event.target.checked })} />
                <span><span>{t(`whd.act.channel.${key}`)}</span><span>{t(`whd.act.channel.${key}.text`)}</span></span>
              </label>
            ))}
          </div>
        </div>
        <p className={styles.note}>{t('whd.act.note')} <span className={styles.tbd}>{t('whd.act.noteTbd')}</span></p>
      </div>
    </Dialog>
  );
}

/**
 * «Bank rekviziti o'zgarishi» [?] (holatlar §5): optovik kabinetdan so'ragan yangi hisob — bank xati bilan
 * solishtirilgach tasdiqlanadi; tasdiqlanguncha o'tkazma eski hisobga. Taklif §8.
 */
export function BankChangeDialog({ wholesaler, onClose }: DialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const review = useReviewBankChangeMutation();
  const [checked, setChecked] = useState(false);
  const change = wholesaler.bankChangeRequest;
  if (!change) return null;
  const decide = (decision: 'APPROVE' | 'REJECT') => {
    if (review.isPending) return;
    review.mutate({ id: wholesaler.id, requestId: change.id, decision }, {
      onSuccess: () => {
        toast.success(t(decision === 'APPROVE' ? 'whd.bank.approved' : 'whd.bank.rejected'));
        onClose();
      },
      onError: (error) => toast.error(t('whd.bank.error'), error),
    });
  };
  const last4 = (value: string | null) => (value ? `···· ${value.slice(-4)}` : '—');
  const rows: [string, string, string][] = [
    [t('whk.req.bank'), wholesaler.bankName ?? '—', change.bankName],
    [t('whk.req.mfo'), wholesaler.bankMfo ?? '—', change.bankMfo],
    [t('whd.bank.account'), last4(wholesaler.bankAccount), last4(change.bankAccount)],
  ];
  return (
    <Dialog
      open
      title={t('whd.bank.title')}
      description={t('whd.bank.sub', { name: wholesaler.name, when: formatCsvDate(change.requestedAt) })}
      icon={<Landmark />}
      tone="warning"
      locked={review.isPending}
      onClose={onClose}
      testId="bank-dialog"
      footer={(
        <>
          <DialogCancel onClick={() => decide('REJECT')} disabled={review.isPending}>{t('whd.bank.reject')}</DialogCancel>
          <DialogPrimary onClick={() => decide('APPROVE')} saving={review.isPending} savingLabel={t('whd.saving')} shortcut={false} disabled={!checked}>{t('whd.bank.approve')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.stack}>
        <table className={styles.compare}>
          <thead><tr><th><span className={styles.visuallyHidden}>{t('whd.bank.field')}</span></th><th>{t('whd.bank.current')}</th><th>{t('whd.bank.requested')}</th></tr></thead>
          <tbody>
            {rows.map(([label, current, requested]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{current}</td>
                <td className={current !== requested ? styles.changed : undefined}>{requested}{current !== requested ? <span>{t('whd.bank.changed')}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {change.file ? (
          <div className={styles.fileRow}>
            <span className={styles.fileIcon} aria-hidden><FileText /></span>
            <span className={styles.fileBody}>
              <span className={styles.fileTop}><span className={styles.fileName}>{change.file.fileName}</span><Lock aria-hidden /><span className={styles.fileMeta}>{t('whd.bank.byWholesaler')}</span></span>
            </span>
          </div>
        ) : null}
        <label className={styles.check}>
          <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
          <span><span>{t('whd.bank.checked')}</span><span>{t('whd.bank.checkedText')}</span></span>
        </label>
        <div className={styles.warning} role="note">
          <TriangleAlert aria-hidden />
          <div>
            <p>{t('whd.bank.warnTitle')}</p>
            <p>{t('whd.bank.warnText')} <span className={styles.tbd}>{t('whd.bank.warnTbd')}</span></p>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * M2 arizasi (BE-30 `POST /admin/wholesalers/{id}/review`): optovik kabinetda o'zi ro'yxatdan o'tgan — STIR, rekvizit va
 * hujjatlar tekshirilib tasdiqlanadi (holat «Faol») yoki sabab bilan rad etiladi. Dizaynda alohida chizilmagan.
 */
export function ReviewDialog({ wholesaler, onClose }: DialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const review = useReviewWholesalerMutation();
  const noteId = useId();
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const missing = rejecting && !note.trim();
  const decide = (decision: 'APPROVE' | 'REJECT') => {
    if (decision === 'REJECT') {
      setRejecting(true);
      if (!note.trim()) return;
    }
    if (review.isPending) return;
    review.mutate({ id: wholesaler.id, decision, note: note.trim() || undefined }, {
      onSuccess: () => {
        toast.success(t(decision === 'APPROVE' ? 'whd.review.approved' : 'whd.review.rejected', { name: wholesaler.name }));
        onClose();
      },
      onError: (error) => toast.error(t('whd.review.error'), error),
    });
  };
  return (
    <Dialog
      open
      title={t('whd.review.title')}
      description={t('whd.review.sub', { name: wholesaler.name, tin: wholesaler.tin ?? '—' })}
      icon={<ClipboardCheck />}
      locked={review.isPending}
      onClose={onClose}
      testId="review-dialog"
      footer={(
        <>
          <DialogCancel onClick={() => decide('REJECT')} disabled={review.isPending}>{t('whd.review.reject')}</DialogCancel>
          <DialogPrimary onClick={() => decide('APPROVE')} saving={review.isPending} savingLabel={t('whd.saving')} shortcut={false}>{t('whd.review.approve')}</DialogPrimary>
        </>
      )}
    >
      <div className={styles.stack}>
        <p className={styles.note}>{t('whd.review.text')}</p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={noteId}>{t('whd.review.note')}</label>
          <textarea id={noteId} className={styles.textarea} value={note} maxLength={500} aria-invalid={missing || undefined} onChange={(event) => setNote(event.target.value)} />
          {missing ? <p className={styles.error}>{t('whd.review.noteRequired')}</p> : null}
        </div>
      </div>
    </Dialog>
  );
}
