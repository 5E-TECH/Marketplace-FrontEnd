import { App } from 'antd';
import axios from 'axios';
import { ChevronRight, CircleX, TriangleAlert } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  useCreateWholesalerMutation,
  useUpdateWholesalerMutation,
  useUploadContractMutation,
  useWholesalerQuery,
  useWholesalersQuery,
} from '../../features/wholesalers/api/wholesalersQueries';
import {
  checkContractFile,
  digitsOnly,
  displayPhone,
  hasContract,
  validateWholesaler,
  wholesalerChanges,
  wholesalerInput,
  type WholesalerField,
} from '../../features/wholesalers/lib/wholesalerRules';
import type { Wholesaler, WholesalerInput } from '../../features/wholesalers/model/wholesalerTypes';
import { ContractFile } from '../../features/wholesalers/ui/ContractFile';
import { getApiErrorFields, getApiErrorMessage } from '../../shared/api/apiError';
import type { TranslationKey } from '../../shared/i18n/translations';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { useLeaveGuard } from '../../shared/lib/useLeaveGuard';
import { useMediaQuery } from '../../shared/lib/useMediaQuery';
import { DateInput } from '../../shared/ui/DateInput/DateInput';
import { Dialog, DialogCancel, DialogPrimary } from '../../shared/ui/Dialog/Dialog';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import styles from './AdminWholesalerFormPage.module.css';

type Errors = Partial<Record<WholesalerField | 'file', string>>;

const FIELDS: readonly WholesalerField[] = ['legalType', 'name', 'tin', 'directorName', 'address', 'phone', 'bankName', 'bankMfo', 'bankAccount', 'contractNumber', 'contractDate'];

/**
 * «Yangi optovik» va rekvizitlarni tahrirlash (FE-25, OPT-1; admin-optovik-karta.holatlar «Yangi optovik»): kompaniya
 * (turi, nomi, STIR, rahbar, yuridik manzil), aloqa, bank rekvizitlari, komissiya shartnomasi (skan, raqami va sanasi —
 * kartada majburiy, lekin shartnomasiz ham saqlanadi). STIR takror — ro'yxatdan darhol va backend 409 bilan.
 */
export default function AdminWholesalerFormPage() {
  const { wholesalerId } = useParams();
  const existing = useWholesalerQuery(wholesalerId ?? '');
  const { t } = useTranslation();
  usePageTitle(wholesalerId ? existing.data?.name ?? null : t('whf.newTitle'));
  if (wholesalerId && existing.isError) return <LoadError error={existing.error} onRetry={() => void existing.refetch()} variant="page" />;
  if (wholesalerId && !existing.data) return <div className={styles.skeleton} aria-busy="true" />;
  return <WholesalerForm key={existing.data?.id ?? 'new'} wholesaler={existing.data ?? null} />;
}

function WholesalerForm({ wholesaler }: { wholesaler: Wholesaler | null }) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const phone = useMediaQuery('(max-width: 767.98px)');
  const all = useWholesalersQuery();
  const create = useCreateWholesalerMutation();
  const update = useUpdateWholesalerMutation();
  const upload = useUploadContractMutation();
  const initial = useMemo(() => wholesalerInput(wholesaler), [wholesaler]);
  const [input, setInput] = useState<WholesalerInput>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [serverDuplicate, setServerDuplicate] = useState<string | null>(null);
  const saving = create.isPending || update.isPending || upload.isPending;
  const dirty = Boolean(file) || FIELDS.some((field) => input[field] !== initial[field]);
  const guard = useLeaveGuard(dirty && !saving);
  const ids = { name: useId(), tin: useId(), director: useId(), address: useId(), phone: useId(), bank: useId(), mfo: useId(), account: useId(), number: useId(), date: useId() };

  const tin = digitsOnly(input.tin);
  const duplicate = all.data?.find((item) => item.tin === tin && item.id !== wholesaler?.id) ?? null;
  const cardPath = (id: string) => `/admin/wholesalers/${encodeURIComponent(id)}`;
  const set = (field: WholesalerField, value: string) => {
    setInput((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    if (field === 'tin') setServerDuplicate(null);
  };

  const fieldError = (field: WholesalerField, kind: 'required' | 'format') => {
    if (kind === 'required') return t('whf.required');
    if (field === 'tin') return t('whf.tinFormat', { count: digitsOnly(input.tin).length });
    return t(`whf.format.${field}` as TranslationKey);
  };

  const validate = (): Errors => {
    const found: Errors = {};
    for (const [field, kind] of Object.entries(validateWholesaler(input)) as [WholesalerField, 'required' | 'format'][]) found[field] = fieldError(field, kind);
    // Imzolangan shartnomaning raqami va sanasi o'chirilmaydi — faqat yangisiga almashtiriladi (BE-07).
    if (wholesaler && hasContract(wholesaler)) {
      if (!input.contractNumber.trim()) found.contractNumber = t('whf.contractKeep');
      if (!input.contractDate) found.contractDate = t('whf.contractKeep');
    }
    if (file) {
      const problem = checkContractFile(file);
      if (problem) found.file = t(`whd.file.${problem}`);
      if (!input.contractNumber.trim()) found.contractNumber = t('whf.contractWithFile');
      if (!input.contractDate) found.contractDate = t('whf.contractWithFile');
    }
    return found;
  };

  const finish = (saved: Wholesaler) => {
    notification.success({ title: t(wholesaler ? 'whf.updated' : 'whf.created', { name: saved.name }), placement: phone ? 'top' : 'bottomRight', duration: 4 });
    void navigate(cardPath(saved.id), { replace: true });
  };

  const onServerError = (error: unknown) => {
    // 409: STIR takrori (`uq_catalog_shop_tin` — «Bu STIR bilan optovik allaqachon bor»); boshqa 409 (holat, nom) —
    // server xabari bilan, STIR ostida emas.
    if (axios.isAxiosError(error) && error.response?.status === 409 && /STIR/i.test(getApiErrorMessage(error))) {
      setServerDuplicate(tin);
      return;
    }
    const fields = getApiErrorFields(error).filter((field): field is WholesalerField => (FIELDS as readonly string[]).includes(field));
    if (fields.length) {
      setErrors(Object.fromEntries(fields.map((field) => [field, getApiErrorMessage(error)])));
      return;
    }
    notification.error({ title: t('whf.error'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
  };

  const uploadThen = (saved: Wholesaler) => {
    if (!file) {
      finish(saved);
      return;
    }
    upload.mutate({ id: saved.id, file, contractNumber: input.contractNumber, contractDate: input.contractDate }, {
      onSuccess: finish,
      // Optovik saqlandi — skan yuklanmasa kartada «Shartnomani yuklash» bilan qayta urinib ko'riladi.
      onError: (error) => {
        notification.warning({ title: t('whf.fileFailed'), description: getApiErrorMessage(error), placement: phone ? 'top' : 'bottomRight' });
        void navigate(cardPath(saved.id), { replace: true });
      },
    });
  };

  const submit = () => {
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean) || duplicate || saving) return;
    if (!wholesaler) {
      create.mutate(input, { onSuccess: uploadThen, onError: onServerError });
      return;
    }
    const changes = wholesalerChanges(input, initial);
    if (!Object.keys(changes).length) {
      uploadThen(wholesaler);
      return;
    }
    update.mutate({ id: wholesaler.id, changes }, { onSuccess: uploadThen, onError: onServerError });
  };

  const duplicateName = duplicate?.name ?? (serverDuplicate === tin ? null : undefined);
  const tinError = errors.tin ?? (duplicateName !== undefined ? t('whf.tinDuplicate', { name: duplicateName ?? t('whf.another') }) : null);

  const field = (key: WholesalerField, id: string, label: string, options: { required?: boolean; placeholder?: string; inputMode?: 'numeric' | 'tel'; hint?: ReactNode; error?: string | null } = {}) => {
    const error = options.error !== undefined ? options.error : errors[key];
    return (
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id}>{label}{options.required ? <span aria-hidden> *</span> : null}</label>
        <div className={styles.control} aria-invalid={error ? true : undefined}>
          <input
            id={id}
            value={input[key]}
            placeholder={options.placeholder}
            inputMode={options.inputMode}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || options.hint ? `${id}-h` : undefined}
            onChange={(event) => set(key, event.target.value)}
            onBlur={key === 'phone' && input.phone.trim() ? () => set('phone', displayPhone(input.phone)) : undefined}
          />
        </div>
        {error ? <p className={styles.error} id={`${id}-h`}><CircleX aria-hidden /><span>{error}</span></p> : options.hint ? <p className={styles.hint} id={`${id}-h`}>{options.hint}</p> : null}
      </div>
    );
  };

  const steps: [TranslationKey, TranslationKey][] = [['whf.after.1', 'whf.after.1.text'], ['whf.after.2', 'whf.after.2.text'], ['whf.after.3', 'whf.after.3.text'], ['whf.after.4', 'whf.after.4.text']];
  const actions = (
    <>
      <Link to={wholesaler ? cardPath(wholesaler.id) : '/admin/wholesalers'} className={styles.secondary}>{t('whd.cancel')}</Link>
      <button type="button" className={styles.primary} onClick={submit} disabled={saving} aria-busy={saving || undefined}>{saving ? t('whd.saving') : t(wholesaler ? 'whf.saveChanges' : 'whf.save')}</button>
    </>
  );

  return (
    <div className={styles.page} data-layout={phone ? 'phone' : undefined}>
      <section className={styles.form} aria-labelledby="whf-title" data-testid="wholesaler-form">
        <h2 id="whf-title" className={styles.visuallyHidden}>{t(wholesaler ? 'whf.editTitle' : 'whf.formTitle')}</h2>

        <div className={styles.group}>
          <h3>{t('whf.company')}</h3>
          <fieldset className={styles.radios}>
            <legend>{t('whf.legalType')}</legend>
            <div>
              {(['LEGAL_ENTITY', 'SOLE_PROPRIETOR'] as const).map((value) => (
                <label key={value} className={styles.radio} data-checked={input.legalType === value || undefined}>
                  <input type="radio" name="legalType" checked={input.legalType === value} onChange={() => set('legalType', value)} />
                  <span>
                    <span>{t(`whf.legal.${value}`)}</span>
                    <span>{t(`whf.legal.${value}.text`)}{value === 'SOLE_PROPRIETOR' ? <span className={styles.tbd}> {t('whf.question37')}</span> : null}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.pair}>
            {field('name', ids.name, t('whf.name'), { required: true })}
            <div>
              {field('tin', ids.tin, t('whf.tin'), { required: true, inputMode: 'numeric', error: tinError, hint: t('whf.tinHint') })}
              {duplicate && !errors.tin ? <Link to={cardPath(duplicate.id)} className={styles.link}>{t('whf.tinCard', { name: duplicate.name })}<ChevronRight aria-hidden /></Link> : null}
            </div>
          </div>
          <div className={styles.pair}>
            {field('directorName', ids.director, t('whf.director'))}
            {field('address', ids.address, t('whf.address'))}
          </div>
        </div>

        <div className={styles.group}>
          <h3>{t('whf.contact')}</h3>
          <p className={styles.groupSub}>{t('whf.contactSub')}</p>
          <div className={styles.pair}>
            {field('phone', ids.phone, t('whf.phone'), { required: true, inputMode: 'tel', placeholder: '+998 90 123 45 67' })}
            <span aria-hidden />
          </div>
        </div>

        <div className={styles.group}>
          <h3>{t('whf.bank')}</h3>
          <p className={styles.groupSub}>{t('whf.bankSub')}</p>
          <div className={styles.pair}>
            {field('bankName', ids.bank, t('whf.bankName'), { required: true })}
            {field('bankMfo', ids.mfo, t('whf.mfo'), { required: true, inputMode: 'numeric' })}
          </div>
          {field('bankAccount', ids.account, t('whf.account'), { required: true, inputMode: 'numeric', placeholder: t('whf.accountPlaceholder') })}
        </div>

        <div className={styles.group}>
          <h3>{t('whf.contract')}</h3>
          <p className={styles.groupSub}>{t('whf.contractSub')}</p>
          <ContractFile file={file} onChange={(next) => { setFile(next); setErrors((previous) => ({ ...previous, file: undefined })); }} phone={phone} label={t('whd.contract.fileLabel')} />
          {errors.file ? <p className={styles.error}><CircleX aria-hidden /><span>{errors.file}</span></p> : null}
          <div className={styles.pair}>
            {field('contractNumber', ids.number, t('whd.contract.number'), { placeholder: 'K-2027/014' })}
            <div className={styles.field}>
              <label className={styles.label} htmlFor={ids.date}>{t('whd.contract.date')}</label>
              <DateInput id={ids.date} value={input.contractDate || null} onChange={(value) => set('contractDate', value ?? '')} aria-invalid={errors.contractDate ? true : undefined} />
              {errors.contractDate ? <p className={styles.error}><CircleX aria-hidden /><span>{errors.contractDate}</span></p> : null}
            </div>
          </div>
          <p className={styles.note}>{t('whf.contractNote')}</p>
        </div>

        {phone ? null : <div className={styles.footer}>{actions}</div>}
      </section>

      <aside className={styles.side} aria-labelledby="whf-after">
        <h2 id="whf-after">{t('whf.after')}</h2>
        <ol className={styles.steps}>
          {steps.map(([title, text], index) => (
            <li key={title}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <span className={styles.stepBody}><span>{t(title)}</span><span>{t(text)}</span></span>
            </li>
          ))}
        </ol>
      </aside>

      {phone ? <PageActionBar>{actions}</PageActionBar> : null}

      {guard.pending ? (
        <Dialog
          open
          title={t('whf.leaveTitle')}
          description={t('whf.leaveText')}
          icon={<TriangleAlert />}
          tone="warning"
          onClose={guard.stay}
          testId="leave-dialog"
          footer={(
            <>
              <DialogCancel onClick={guard.stay}>{t('whf.stay')}</DialogCancel>
              <DialogPrimary danger shortcut={false} onClick={guard.leave}>{t('whf.leave')}</DialogPrimary>
            </>
          )}
        >
          {null}
        </Dialog>
      ) : null}
    </div>
  );
}
