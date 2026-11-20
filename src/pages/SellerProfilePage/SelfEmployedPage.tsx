import { App, Button, Form, Input, Progress, Skeleton } from 'antd';
import axios from 'axios';
import { BadgeCheck, BookOpen, Check, CircleAlert, CircleCheck, CircleX, Clock, ExternalLink, FileText, Lock, Upload, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  isPinfl,
  openSelfEmployedDocument,
  uploadSelfEmployedDocument,
  useSellerProfileQuery,
  useSubmitSelfEmployedMutation,
  type SellerProfile,
  type UploadedDocument,
} from '../../features/sellerProfile/api/sellerProfileApi';
import { selfEmployedStatusKey } from '../../features/sellerProfile/lib/selfEmployedStatus';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import { formatMoney } from '../../shared/ui/MoneyText/formatMoney';
import { PageActionBar } from '../../shared/ui/PageActionBar/PageActionBar';
import { usePhoneActionBar } from '../../shared/ui/PageActionBar/usePhoneActionBar';
import { SheetModal } from '../../shared/ui/SheetModal/SheetModal';
import { useAffiliateBalanceQuery } from '../../features/affiliate/api/affiliateApi';
import e from './profileE.module.css';
import styles from './sellerProfile.module.css';

/** Eng kam yechish summasi va soliq (FE-07 qoidasi: kamida 50 000 so'm, 1%). */
const MIN_WITHDRAWAL = 50_000;
const TAX_PERCENT = 1;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * «JShShIR va soliq maqomi» (sotuvchi-jshshir): kiritilmagan → tekshirilmoqda →
 * tasdiqlangan / rad etildi / bekor qilingan. Maqomsiz sotuvchiga to'lov qilinmaydi (TZ 8).
 * Telefonda «Yo‘riqnoma» va «JShShIR kiritish» pastki panelda (karkas-E 4.4).
 */
export default function SelfEmployedPage() {
  const { t } = useTranslation();
  const query = useSellerProfileQuery();
  const phone = usePhoneActionBar();
  const [submitting, setSubmitting] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  if (query.isError && !query.data) {
    return <LoadError variant="page" error={query.error} onRetry={() => void query.refetch()} lastSuccessAt={query.dataUpdatedAt} />;
  }
  if (!query.data) return <Skeleton active paragraph={{ rows: 8 }} />;

  const profile = query.data;
  const info = profile.selfEmployed;
  const canSubmit = info.status === 'NOT_SUBMITTED' || info.status === 'REJECTED' || info.status === 'REVOKED';
  const submitLabel = info.status === 'NOT_SUBMITTED' ? t('selfEmployed.submit') : t('selfEmployed.resubmit');
  // Tasdiqlangan va tekshirilayotgan holatda kartada amal yo'q (sotuvchi-jshshir) — yo'riqnoma o'ngdagi kartada.
  const actions = canSubmit ? (
    <>
      <button type="button" className={e.btn} onClick={() => setGuideOpen(true)}>{t('selfEmployed.guideButton')}</button>
      <button type="button" className={`${e.btn} ${e.btnPrimary}`} onClick={() => setSubmitting(true)}>{submitLabel}</button>
    </>
  ) : null;
  // Telefon: pastki panel (karkas-E 4.4) — 52 px tugmalar.
  const barActions = canSubmit ? (
    <>
      <Button size="large" onClick={() => setGuideOpen(true)}>{t('selfEmployed.guideButton')}</Button>
      <Button type="primary" size="large" onClick={() => setSubmitting(true)}>{submitLabel}</Button>
    </>
  ) : null;

  return (
    <div className={e.page}>
      <StatusCard profile={profile} actions={phone ? null : actions} />

      <div className={e.cols}>
        <div className={e.colMain}>
          <TaxCard />
          {info.documentName ? <DocumentCard name={info.documentName} /> : null}
        </div>
        <div className={e.colSide}>
          <section className={e.card} data-gap="8" aria-labelledby="self-employed-guide">
            <div className={e.sectionHead}>
              <div>
                <h2 id="self-employed-guide" className={e.h2}>{t('selfEmployed.guideTitle')}</h2>
                <p className={e.lead}>{t('selfEmployed.guideLead')}</p>
              </div>
            </div>
            <ul className={styles.guideList}>
              {GUIDE_ITEMS.map(([title, text]) => (
                <li key={title}>
                  <span className={styles.guideQ}>{t(title)}</span>
                  <span className={styles.guideA}>{t(text)}</span>
                </li>
              ))}
            </ul>
            <button type="button" className={`${e.btn} ${e.btnBlock}`} onClick={() => setGuideOpen(true)}>
              <BookOpen aria-hidden />
              {t('selfEmployed.fullGuide')}
            </button>
          </section>
        </div>
      </div>

      {barActions ? <PageActionBar>{barActions}</PageActionBar> : null}

      <GuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        submitLabel={canSubmit ? submitLabel : null}
        onSubmit={() => {
          setGuideOpen(false);
          setSubmitting(true);
        }}
      />
      <SubmitModal open={submitting} profile={profile} onClose={() => setSubmitting(false)} />
    </div>
  );
}

/** «Yo‘riqnoma» kartasi (sotuvchi-jshshir): savol — javob, chiziq bilan. */
const GUIDE_ITEMS = [
  ['selfEmployed.guideWhy', 'selfEmployed.guideWhyText'],
  ['selfEmployed.guideActivity', 'selfEmployed.guideActivityText'],
  ['selfEmployed.guideWhere', 'selfEmployed.guideWhereText'],
  ['selfEmployed.guideRevoked', 'selfEmployed.guideRevokedText'],
  ['selfEmployed.guideName', 'selfEmployed.guideNameText'],
] as const;

/** «Soliq — 1%»: misol hozirgi «Mavjud» summa bilan (50 000 dan kam bo'lsa — eng kam summa bilan). */
function TaxCard() {
  const { t } = useTranslation();
  const balance = useAffiliateBalanceQuery();
  const available = balance.data?.available ?? 0;
  const amount = available >= MIN_WITHDRAWAL ? available : MIN_WITHDRAWAL;
  const fee = Math.round((amount * TAX_PERCENT) / 100);
  const money = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  return (
    <section className={e.card} data-gap="14" aria-labelledby="self-employed-tax">
      <div className={e.sectionHead}>
        <div>
          <h2 id="self-employed-tax" className={e.h2}>{t('selfEmployed.taxTitle')}</h2>
          <p className={e.lead}>{t('selfEmployed.taxLead')}</p>
        </div>
      </div>
      <div className={styles.taxBox}>
        <p className={styles.taxBoxTitle}>{available >= MIN_WITHDRAWAL ? t('selfEmployed.taxExampleBalance') : t('selfEmployed.taxExampleMin')}</p>
        <dl className={styles.taxRows}>
          <div><dt>{t('selfEmployed.taxAmount')}</dt><dd>{money(amount)}</dd></div>
          <div><dt>{t('selfEmployed.taxFee')}</dt><dd>{'\u2212'}{money(fee)}</dd></div>
          <div><dt>{t('selfEmployed.taxNet')}</dt><dd className={styles.taxNet}>{money(amount - fee)}</dd></div>
        </dl>
      </div>
    </section>
  );
}

/** «Hujjat»: yopiq ma'lumotnoma — faqat egasi va tekshiruvchi ochadi. */
function DocumentCard({ name }: { name: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [opening, setOpening] = useState(false);
  const openDocument = () => {
    setOpening(true);
    openSelfEmployedDocument()
      .catch((error: unknown) => void message.error(`${t('selfEmployed.openFailed')}: ${getApiErrorMessage(error)}`))
      .finally(() => setOpening(false));
  };
  return (
    <section className={e.card} data-gap="8" aria-labelledby="self-employed-document">
      <div className={e.sectionHead}>
        <div>
          <h2 id="self-employed-document" className={e.h2}>{t('selfEmployed.document')}</h2>
          <p className={e.lead}>{t('selfEmployed.documentText')}</p>
        </div>
      </div>
      <div className={styles.fileLine}>
        <span className={styles.docBox} aria-hidden><FileText /></span>
        <div className={styles.fileLineText}>
          <p className={styles.fileLineName}>
            {name} <Lock className={styles.fileLock} aria-label={t('selfEmployed.documentPrivate')} />
          </p>
          <p className={styles.fileLineSub}>{t('selfEmployed.documentUsed')}</p>
        </div>
        <button type="button" className={`${e.btn} ${e.btnSmall}`} title={t('selfEmployed.documentLink')} disabled={opening} aria-busy={opening || undefined} onClick={openDocument}>
          <ExternalLink aria-hidden />
          {t('selfEmployed.openDocument')}
        </button>
      </div>
    </section>
  );
}

function GuideAnswers() {
  const { t } = useTranslation();
  return (
    <dl className={styles.guide}>
      <dt>{t('selfEmployed.guideWhy')}</dt>
      <dd>{t('selfEmployed.guideWhyText')}</dd>
      <dt>{t('selfEmployed.guideActivity')}</dt>
      <dd>{t('selfEmployed.guideActivityText')}</dd>
      <dt>{t('selfEmployed.guideRevoked')}</dt>
      <dd>{t('selfEmployed.guideRevokedText')}</dd>
      <dt>{t('selfEmployed.guideName')}</dt>
      <dd>{t('selfEmployed.guideNameText')}</dd>
    </dl>
  );
}

/** «O‘zini o‘zi band qilganlik — yo‘riqnoma» (sotuvchi-jshshir 6-bo'lim, 640 px). */
function GuideModal({ open, onClose, submitLabel, onSubmit }: { open: boolean; onClose: () => void; submitLabel: string | null; onSubmit: () => void }) {
  const { t } = useTranslation();
  const fee = Math.round((MIN_WITHDRAWAL * TAX_PERCENT) / 100);
  const money = (value: number) => t('affiliateHome.sum', { amount: formatMoney(value) });
  const steps = [
    ['selfEmployed.guideStep1', 'selfEmployed.guideStep1Text'],
    ['selfEmployed.guideStep2', 'selfEmployed.guideStep2Text'],
    ['selfEmployed.guideStep3', 'selfEmployed.guideStep3Text'],
    ['selfEmployed.guideStep4', 'selfEmployed.guideStep4Text'],
  ] as const;
  return (
    <SheetModal
      open={open}
      width={640}
      title={
        <span className={styles.modalTitle}>
          <span>{t('selfEmployed.guideModalTitle')}</span>
          <span className={styles.muted}>{t('selfEmployed.guideModalLead')}</span>
        </span>
      }
      onCancel={onClose}
      footer={
        <div className={styles.modalActions}>
          <Button size="large" onClick={onClose}>{t('register.close')}</Button>
          {submitLabel ? <Button size="large" type="primary" onClick={onSubmit}>{submitLabel}</Button> : null}
        </div>
      }
    >
      <ol className={styles.guideSteps}>
        {steps.map(([title, text], index) => (
          <li key={title}>
            <span className={styles.needNumber} aria-hidden>{index + 1}</span>
            <span className={styles.readinessText}>
              <strong>{t(title)}</strong>
              <span className={styles.muted}>{t(text)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className={styles.taxExample}>
        {t('selfEmployed.taxExample', { amount: money(MIN_WITHDRAWAL), fee: money(fee), net: money(MIN_WITHDRAWAL - fee) })}
      </p>
      <GuideAnswers />
    </SheetModal>
  );
}

const STATUS_ICON = { NOT_SUBMITTED: FileText, PENDING: Clock, VERIFIED: BadgeCheck, REJECTED: CircleX, REVOKED: CircleAlert } as const;
const STATUS_TONE = { NOT_SUBMITTED: 'neutral', PENDING: 'info', VERIFIED: 'success', REJECTED: 'danger', REVOKED: 'warning' } as const;

/** Holat kartasi (sotuvchi-jshshir 1-qator): chapda belgi, holat va ma'lumot; o'ngda tekshiruv bosqichlari. */
function StatusCard({ profile, actions }: { profile: SellerProfile; actions: ReactNode }) {
  const { t } = useTranslation();
  const info = profile.selfEmployed;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const tone = STATUS_TONE[info.status];
  const Icon = STATUS_ICON[info.status];
  const heading = {
    NOT_SUBMITTED: { title: t('selfEmployed.notSubmittedTitle'), text: t('selfEmployed.notSubmittedText') },
    PENDING: { title: t('selfEmployed.pendingTitle'), text: t('selfEmployed.pendingText', { time: info.submittedAt ? tashkentDateTime(info.submittedAt) : '—' }) },
    VERIFIED: { title: t('selfEmployed.verifiedTitle'), text: t('selfEmployed.verifiedText') },
    REJECTED: { title: t('selfEmployed.rejectedTitle'), text: t('selfEmployed.rejectedText', { time: info.checkedAt ? tashkentDateTime(info.checkedAt) : '—' }) },
    REVOKED: { title: t('selfEmployed.revokedTitle'), text: t('selfEmployed.revokedText') },
  }[info.status];
  const canSubmit = info.status === 'NOT_SUBMITTED' || info.status === 'REJECTED' || info.status === 'REVOKED';
  const showSteps = info.status === 'PENDING' || info.status === 'VERIFIED';
  const verified = info.status === 'VERIFIED';
  const steps = [
    { title: t('selfEmployed.stepSent'), text: t('selfEmployed.stepSentText'), done: true, time: null },
    { title: t('selfEmployed.stepChecked'), text: t('selfEmployed.stepCheckedText'), done: verified, time: null },
    { title: t('selfEmployed.stepVerified'), text: t('selfEmployed.stepVerifiedText'), done: verified, time: verified && info.checkedAt ? tashkentDateTime(info.checkedAt).slice(0, 5) + ', ' + tashkentDateTime(info.checkedAt).slice(-5) : null },
  ];

  return (
    <section className={`${e.card} ${styles.hero}`} aria-labelledby="self-employed-status">
      <div className={styles.heroMain}>
        <div className={styles.heroHead}>
          <span className={styles.heroIcon} data-tone={tone} aria-hidden><Icon /></span>
          <div className={styles.heroText}>
            <span className={styles.heroChip}>
              <span className={e.chip} data-tone={tone}>
                {verified ? <CircleCheck aria-hidden /> : null}
                {t(selfEmployedStatusKey(info.status))}
              </span>
            </span>
            <h2 id="self-employed-status" className={styles.heroTitle}>{heading.title}</h2>
            <p className={styles.heroLead}>{heading.text}</p>
          </div>
        </div>

        {(info.status === 'REJECTED' || info.status === 'REVOKED') && (info.reason || info.comment) ? (
          <div className={styles.reason}>
            {info.reason ? <span><strong>{t('selfEmployed.reason')}:</strong> {info.reason}</span> : null}
            {info.comment ? <span className={styles.muted}>{t('selfEmployed.comment', { comment: info.comment })}</span> : null}
          </div>
        ) : null}

        {info.status === 'NOT_SUBMITTED' ? (
          <>
            <h3 className={styles.subTitle}>{t('selfEmployed.needTitle')}</h3>
            <ol className={styles.needList}>
              {([['selfEmployed.need1', 'selfEmployed.need1Text'], ['selfEmployed.need2', 'selfEmployed.need2Text'], ['selfEmployed.need3', 'selfEmployed.need3Text']] as const).map(([title, text], index) => (
                <li key={title}>
                  <span className={styles.needNumber} aria-hidden>{index + 1}</span>
                  <span className={styles.readinessText}>
                    <strong>{t(title)}</strong>
                    <span className={styles.muted}>{t(text)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            {info.status === 'PENDING' ? <p className={e.note}>{t('selfEmployed.sentDataLocked')}</p> : null}
            <dl className={e.rows}>
              <InfoRow label={t('sellerProfile.pinfl')} value={info.pinflLast4 ? `···· ${info.pinflLast4}` : '—'} sub={t('selfEmployed.pinflHidden')} />
              <InfoRow label={t('selfEmployed.fullName')} value={fullName || '—'} sub={t('selfEmployed.fullNameNote')} />
              <InfoRow label={t('sellerProfile.activity')} value={info.activity ?? t('sellerProfile.activityValue')} sub={t('sellerProfile.activityNote')} />
              {info.checkedAt && verified ? <InfoRow label={t('sellerProfile.checkedAt')} value={tashkentDateTime(info.checkedAt)} /> : null}
            </dl>
          </>
        )}

        {actions ? <div className={e.actions}>{actions}</div> : null}
        {canSubmit && !fullName ? (
          <span className={styles.muted}>{t('selfEmployed.nameMissing')} <Link to="/profile" className={styles.link}>{t('sellerProfile.title')}</Link></span>
        ) : null}
      </div>

      {showSteps ? (
        <div className={styles.heroSteps}>
          <ol className={styles.vSteps} aria-label={t('selfEmployed.steps')}>
            {steps.map((step) => (
              <li key={step.title} data-done={step.done}>
                <span className={styles.vDot} aria-hidden>{step.done ? <Check /> : null}</span>
                <span className={styles.vText}>
                  <span className={styles.vTitle}>{step.title}</span>
                  <span className={styles.vSub}>{step.text}</span>
                </span>
                {step.time ? <span className={styles.vTime}>{step.time}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

function InfoRow({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className={e.row}>
      <dt className={e.rowLabel}>{label}</dt>
      <dd className={e.rowValue}>
        <span className={e.rowMain}>
          <span className={e.val}>{value}</span>
          {sub ? <span className={e.sub}>{sub}</span> : null}
        </span>
      </dd>
    </div>
  );
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; file: File; percent: number }
  | { phase: 'failed'; file: File; message: string }
  | { phase: 'done'; file: File; uploaded: UploadedDocument };

/** «JShShIR kiritish» (560 px): JShShIR, F.I.Sh. va faoliyat turi profildan, ma'lumotnoma yuklanadi. */
function SubmitModal({ open, profile, onClose }: { open: boolean; profile: SellerProfile; onClose: () => void }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<{ pinfl: string }>();
  const pinfl = Form.useWatch('pinfl', form) ?? '';
  const [upload, setUpload] = useState<UploadState>({ phase: 'idle' });
  const [fileError, setFileError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const submit = useSubmitSelfEmployedMutation();
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();

  const startUpload = (file: File) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setUpload({ phase: 'uploading', file, percent: 0 });
    uploadSelfEmployedDocument(file, {
      signal: controller.signal,
      onProgress: (percent) => setUpload((current) => (current.phase === 'uploading' && current.file === file ? { ...current, percent } : current)),
    }).then(
      (uploaded) => setUpload((current) => (current.phase === 'uploading' && current.file === file ? { phase: 'done', file, uploaded } : current)),
      (error: unknown) => {
        if (axios.isCancel(error)) return;
        setUpload((current) => (current.phase === 'uploading' && current.file === file
          ? { phase: 'failed', file, message: axios.isAxiosError(error) && !error.response ? t('selfEmployed.uploadFailed') : getApiErrorMessage(error) }
          : current));
      },
    );
  };

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > MAX_FILE_BYTES) {
      setFileError(t('selfEmployed.fileTooBig'));
      return;
    }
    setFileError(null);
    startUpload(picked);
  };

  const stopUpload = () => {
    abortRef.current?.abort();
    setUpload({ phase: 'idle' });
  };

  const close = () => {
    abortRef.current?.abort();
    form.resetFields();
    setUpload({ phase: 'idle' });
    setFileError(null);
    onClose();
  };

  const uploading = upload.phase === 'uploading';

  return (
    <SheetModal
      open={open}
      width={560}
      title={t('selfEmployed.modalTitle')}
      okText={t('selfEmployed.sendForCheck')}
      cancelText={t('sellerProfile.cancel')}
      okButtonProps={{ disabled: !fullName || uploading || upload.phase === 'failed' }}
      confirmLoading={submit.isPending}
      destroyOnHidden
      onOk={() => form.submit()}
      onCancel={close}
    >
      <p className={styles.note}>{t('selfEmployed.modalLead')}</p>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        className={styles.modalForm}
        onFinish={({ pinfl: value }) =>
          submit.mutate(
            { pinfl: value, documentId: upload.phase === 'done' ? upload.uploaded.documentId : undefined },
            {
              onSuccess: () => {
                void message.success(t('selfEmployed.sent'));
                close();
              },
              onError: (error) => void message.error(getApiErrorMessage(error)),
            },
          )
        }
      >
        <Form.Item
          label={<span>{t('sellerProfile.pinfl')} <span className={styles.muted}>{pinfl.length} / 14</span></span>}
          name="pinfl"
          normalize={(value?: string) => (value ?? '').replace(/\D/g, '').slice(0, 14)}
          validateTrigger={['onBlur', 'onSubmit']}
          extra={t('selfEmployed.pinflHint')}
          rules={[
            { required: true, message: t('selfEmployed.pinflRequired') },
            {
              validator: (_rule, value: unknown) =>
                typeof value !== 'string' || !value || isPinfl(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('selfEmployed.pinflShort', { count: 14 - value.length }))),
            },
          ]}
        >
          <Input inputMode="numeric" autoComplete="off" spellCheck={false} className={styles.numeric} />
        </Form.Item>
        <Form.Item label={t('selfEmployed.fullName')} extra={fullName ? t('selfEmployed.fullNameHint') : t('selfEmployed.nameMissing')}>
          <div className={styles.readonlyValue}>{fullName || '—'}</div>
        </Form.Item>
        <Form.Item label={t('sellerProfile.activity')} extra={t('selfEmployed.activityHint')}>
          <div className={styles.readonlyValue}>{t('sellerProfile.activityValue')} · <span className={styles.muted}>{t('sellerProfile.activityNote')}</span></div>
        </Form.Item>
        <Form.Item
          label={t('selfEmployed.fileLabel')}
          validateStatus={fileError ? 'error' : undefined}
          help={fileError ?? (uploading ? t('selfEmployed.uploadBlocks') : t('selfEmployed.fileTypes'))}
        >
          {upload.phase === 'idle' ? (
            <label
              className={styles.dropzone}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                pickFile(event.dataTransfer.files[0]);
              }}
            >
              <Upload size={20} aria-hidden />
              <span>{t('selfEmployed.fileDrop')}</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className={styles.visuallyHidden}
                onChange={(event) => {
                  pickFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          ) : (
            <div className={styles.fileRow} data-state={upload.phase}>
              {upload.phase === 'failed' ? <CircleAlert size={18} aria-hidden /> : <FileText size={18} aria-hidden />}
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{upload.file.name} — <span className={styles.muted}>{t('selfEmployed.documentPrivate')}</span></span>
                {upload.phase === 'uploading' ? (
                  <Progress percent={upload.percent} size="small" aria-label={t('selfEmployed.uploading', { percent: upload.percent })} />
                ) : null}
                {upload.phase === 'failed' ? <span className={styles.fileError} role="alert">{upload.message}</span> : null}
              </div>
              {upload.phase === 'uploading' ? (
                <Button type="text" size="small" icon={<X size={16} />} aria-label={t('selfEmployed.uploadStop')} onClick={stopUpload} />
              ) : upload.phase === 'failed' ? (
                <>
                  <Button size="small" onClick={() => startUpload(upload.file)}>{t('selfEmployed.uploadRetry')}</Button>
                  <Button type="text" size="small" icon={<X size={16} />} aria-label={t('selfEmployed.fileRemove')} onClick={() => setUpload({ phase: 'idle' })} />
                </>
              ) : (
                <Button type="text" size="small" icon={<X size={16} />} aria-label={t('selfEmployed.fileRemove')} onClick={() => setUpload({ phase: 'idle' })} />
              )}
            </div>
          )}
        </Form.Item>
        <p className={styles.note}>{t('selfEmployed.resultNote')}</p>
      </Form>
    </SheetModal>
  );
}
