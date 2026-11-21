import { App } from 'antd';
import { ArrowDown, ArrowUp, Check, Lock, Pencil, Plus, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useCreativesQuery, useOfferContentQuery, useProductPricingQuery, useSaveOfferContentMutation } from '../../../features/adminProducts/api/adminProductsQueries';
import type { AdminProduct, OfferContent } from '../../../features/adminProducts/model/adminProductTypes';
import { LandingPreviewDialog } from '../../../features/adminProducts/ui/LandingPreviewDialog';
import { SideCard } from '../../../features/adminProducts/ui/SideCard';
import { scriptSteps } from '../../../features/operator/lib/leadRules';
import { getApiErrorMessage } from '../../../shared/api/apiError';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { tashkentClock } from '../../../shared/lib/tashkentTime';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { usePhoneActionBar } from '../../../shared/ui/PageActionBar/usePhoneActionBar';
import styles from '../AdminProductDetailPage.module.css';

const LINE_MAX = 200;
/** Qo'lda yozilgan summa: «262 000 so'm», «30000 sum» — narx lid kartasida turadi (admin-skript 8). */
const AMOUNT = /\d[\d\s]{2,}\s*(so[‘'ʻ’`]?m|sum)\b/i;
const clean = (lines: readonly string[]) => lines.map((line) => line.trim()).filter(Boolean);
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

interface ContentTabProps {
  product: AdminProduct;
  onDirtyChange: (dirty: boolean) => void;
}

/**
 * Saqlash qatori (admin-skript, admin-landing-mazmuni tepasi): holat, «Bekor qilish», «Saqlash». Telefonda
 * (…mobil taxtalari) kartada holat va «Bekor qilish» havolasi, «Oldindan ko'rish» va «Saqlash» — pastki panelda.
 */
function SaveBar({ content, dirty, saving, onCancel, onSave, onPreview }: {
  content: OfferContent | undefined;
  dirty: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onPreview?: () => void;
}) {
  const { t } = useTranslation();
  const phone = usePhoneActionBar();
  const updatedAt = content?.updatedAt ? Date.parse(content.updatedAt) : 0;
  const saved = updatedAt > 0 ? t('content.saved', { time: tashkentClock(updatedAt) }) : t('content.never');
  const saveButton = (className: string) => (
    <button type="button" className={className} onClick={onSave} disabled={!dirty || saving} aria-busy={saving || undefined}>{saving ? t('moderation.saving') : t('content.save')}</button>
  );
  return (
    <>
      <section className={styles.saveBar} data-testid="content-save-bar">
        <div>
          <p className={styles.saveState}>
            <span className={styles.stateChip} data-dirty={dirty || undefined}>{dirty ? <Pencil aria-hidden /> : <Check aria-hidden />}{dirty ? t('content.dirty') : saved}</span>
          </p>
          <p className={styles.mutedSmall}>{t('content.live')}</p>
          {phone && dirty ? <button type="button" className={styles.textButton} onClick={onCancel} disabled={saving}>{t('content.cancel')}</button> : null}
        </div>
        {phone ? null : (
          <div className={styles.saveActions}>
            {onPreview ? <button type="button" className={styles.smallButton} onClick={onPreview}><Smartphone aria-hidden />{t('aoffer.preview')}</button> : null}
            <button type="button" className={styles.ghostButton} onClick={onCancel} disabled={!dirty || saving}>{t('content.cancel')}</button>
            {saveButton(styles.primaryButton)}
          </div>
        )}
      </section>
      <PageActionBar>
        {onPreview ? <button type="button" className={styles.barSecondary} onClick={onPreview}>{t('aoffer.preview')}</button> : null}
        {saveButton(styles.barPrimary)}
      </PageActionBar>
    </>
  );
}

/**
 * «Skript» (admin-skript; OPR-2): suhbat skripti — bitta matn, har qator lid kartasida raqamlangan qadam
 * (`LeadCardDto.callScript`, TC3). Birinchi qatorda yozib olinishi haqida ogohlantirish; summalar matnga yozilmaydi.
 * Versiyalar, e'lon qilish, o'zgaruvchilar va ruscha skript — kartada yo'q.
 */
export function ScriptTab({ product, onDirtyChange }: ContentTabProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const query = useOfferContentQuery(product.id);
  const save = useSaveOfferContentMutation();
  const initial = useMemo(() => scriptSteps(query.data?.callScript ?? null), [query.data]);
  const [edited, setEdited] = useState<string[] | null>(null);
  const [touched, setTouched] = useState(false);
  const lines = edited ?? initial;
  const dirty = edited !== null && !same(clean(edited), initial);
  const notice = t('ascript.notice');
  const noticeError = lines.length > 0 && !lines[0]?.includes(notice);
  const amountLines = lines.map((line, index) => (AMOUNT.test(line) ? index : -1)).filter((index) => index >= 0);
  const invalid = noticeError || amountLines.length > 0;

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const set = (next: string[]) => setEdited(next);
  const submit = () => {
    setTouched(true);
    if (!dirty || invalid || !query.data) return;
    const script = clean(lines).join('\n') || null;
    save.mutate({ productId: product.id, content: { callScript: script, highlights: query.data.highlights, boxContents: query.data.boxContents } }, {
      onSuccess: () => {
        setEdited(null);
        setTouched(false);
        notification.success({ title: t('content.savedToast'), placement: 'bottomRight', duration: 3 });
      },
      onError: (error) => notification.error({ title: t('content.saveFailed'), description: getApiErrorMessage(error), placement: 'bottomRight' }),
    });
  };
  const sample = () => set([1, 2, 3, 4, 5].map((index) => t(`ascript.sample${index}` as 'ascript.sample1', { product: product.name })));

  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} title={t('content.loadError')} />;

  return (
    <div className={styles.contentTab}>
      <SaveBar content={query.data} dirty={dirty} saving={save.isPending} onCancel={() => { setEdited(null); setTouched(false); }} onSave={submit} />
      <div className={`${styles.columns} ${styles.contentLayout}`}>
        <div className={styles.mainColumn}>
          <section className={styles.panel} data-testid="script-editor">
            <div className={styles.panelHead}>
              <div>
                <h2>{t('ascript.title')}</h2>
                <p>{t('ascript.hint')}</p>
              </div>
            </div>
            {lines.length === 0 ? (
              <div className={styles.emptyBox}>
                <p className={styles.emptyTitle}>{t('ascript.emptyTitle')}</p>
                <p className={styles.mutedSmall}>{t('ascript.emptyText')}</p>
                <button type="button" className={styles.primaryButton} onClick={sample}>{t('ascript.useSample')}</button>
              </div>
            ) : (
              <ol className={styles.steps}>
                {lines.map((line, index) => (
                  <li key={index} className={styles.stepCard}>
                    <div className={styles.stepHead}>
                      <span className={styles.stepNumber}>{index + 1}</span>
                      <span className={styles.stepTitle}>{t('ascript.step', { index: index + 1 })}</span>
                      {index === 0 ? <span className={styles.requiredChip}><Lock aria-hidden />{t('ascript.required')}</span> : null}
                      <span className={styles.stepTools}>
                        <button type="button" aria-label={t('ascript.moveUp', { index: index + 1 })} disabled={index === 0} onClick={() => set(lines.map((value, i) => (i === index - 1 ? lines[index] : i === index ? lines[index - 1] : value)))}><ArrowUp aria-hidden /></button>
                        <button type="button" aria-label={t('ascript.moveDown', { index: index + 1 })} disabled={index === lines.length - 1} onClick={() => set(lines.map((value, i) => (i === index + 1 ? lines[index] : i === index ? lines[index + 1] : value)))}><ArrowDown aria-hidden /></button>
                        <button type="button" aria-label={t('ascript.remove', { index: index + 1 })} disabled={index === 0} onClick={() => set(lines.filter((_, i) => i !== index))}><Trash2 aria-hidden /></button>
                      </span>
                    </div>
                    <textarea
                      className={styles.stepText}
                      value={line}
                      rows={2}
                      aria-label={t('ascript.stepAria', { index: index + 1 })}
                      aria-invalid={(touched && ((index === 0 && noticeError) || amountLines.includes(index))) || undefined}
                      onChange={(event) => set(lines.map((value, i) => (i === index ? event.target.value : value)))}
                    />
                    {index === 0 ? <p className={styles.fieldHint}>{t('ascript.noticeHint')}</p> : null}
                    {touched && index === 0 && noticeError ? <p className={styles.fieldError} role="alert">{t('ascript.noticeMissing', { notice })}</p> : null}
                    {touched && amountLines.includes(index) ? <p className={styles.fieldError} role="alert">{t('ascript.amountError')}</p> : null}
                  </li>
                ))}
              </ol>
            )}
            {lines.length ? (
              <button type="button" className={styles.addRow} onClick={() => set([...lines, ''])}><Plus aria-hidden />{t('ascript.add')}</button>
            ) : null}
          </section>
        </div>
        <div className={styles.sideColumn}>
          <SideCard title={t('ascript.operator')} hint={t('ascript.operatorHint')} testId="script-preview">
            <p className={styles.fieldLabel}>{t('ascript.operatorTitle')}</p>
            {clean(lines).length ? (
              <ol className={styles.operatorView}>{clean(lines).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
            ) : <p className={styles.muted}>{t('ascript.operatorEmpty')}</p>}
          </SideCard>
          <SideCard title={t('ascript.rules')}>
            <ul className={styles.ruleList}>
              {(['ascript.rule1', 'ascript.rule2', 'ascript.rule3'] as const).map((rule) => <li key={rule}><ShieldCheck aria-hidden />{t(rule)}</li>)}
            </ul>
          </SideCard>
        </div>
      </div>
    </div>
  );
}

/** Ro'yxat muharriri: qator matni, o'chirish; «+ Qo'shish». */
function LineList({ lines, label, placeholder, removeLabel, onChange, touched }: {
  lines: readonly string[];
  label: (index: number) => string;
  placeholder: string;
  removeLabel: (index: number) => string;
  onChange: (lines: string[]) => void;
  touched: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ol className={styles.lineList}>
      {lines.map((line, index) => (
        <li key={index}>
          <span className={styles.stepNumber}>{index + 1}</span>
          <input
            className={styles.lineInput}
            value={line}
            maxLength={LINE_MAX + 50}
            aria-label={label(index + 1)}
            placeholder={placeholder}
            aria-invalid={(touched && line.trim().length > LINE_MAX) || undefined}
            onChange={(event) => onChange(lines.map((value, i) => (i === index ? event.target.value : value)))}
          />
          <button type="button" className={styles.iconTool} aria-label={removeLabel(index + 1)} onClick={() => onChange(lines.filter((_, i) => i !== index))}><Trash2 aria-hidden /></button>
          {touched && line.trim().length > LINE_MAX ? <p className={styles.fieldError} role="alert">{t('alanding.lineTooLong')}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * «Landing» (admin-landing-mazmuni; ega qarori 2026-11-17): sotuvchi sahifasidagi «afzalliklar» (2–3 qator)
 * va «Qutida» ro'yxati. Nom va qisqa tavsif — «Asosiy» yorlig'idan; media tartibi, shablon va e'lon qilish — kartada yo'q.
 */
export function LandingTab({ product, onDirtyChange }: ContentTabProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const query = useOfferContentQuery(product.id);
  const creatives = useCreativesQuery(product.id).data ?? [];
  const pricing = useProductPricingQuery(product.id).data;
  const save = useSaveOfferContentMutation();
  const [highlights, setHighlights] = useState<string[] | null>(null);
  const [box, setBox] = useState<string[] | null>(null);
  const [touched, setTouched] = useState(false);
  const [preview, setPreview] = useState(false);
  const savedHighlights = query.data?.highlights ?? [];
  const savedBox = query.data?.boxContents ?? [];
  const currentHighlights = highlights ?? savedHighlights;
  const currentBox = box ?? savedBox;
  const dirty = (highlights !== null && !same(clean(highlights), savedHighlights)) || (box !== null && !same(clean(box), savedBox));
  const tooFew = clean(currentHighlights).length < 2;
  const tooLong = [...currentHighlights, ...currentBox].some((line) => line.trim().length > LINE_MAX);
  const invalid = tooFew || tooLong;

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const reset = () => { setHighlights(null); setBox(null); setTouched(false); };
  const submit = () => {
    setTouched(true);
    if (!dirty || invalid) return;
    save.mutate({ productId: product.id, content: { highlights: clean(currentHighlights), boxContents: clean(currentBox) } }, {
      onSuccess: () => {
        reset();
        notification.success({ title: t('content.savedToast'), placement: 'bottomRight', duration: 3 });
      },
      onError: (error) => notification.error({ title: t('content.saveFailed'), description: getApiErrorMessage(error), placement: 'bottomRight' }),
    });
  };

  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} title={t('content.loadError')} />;

  const previewContent: OfferContent | undefined = query.data && { ...query.data, highlights: clean(currentHighlights), boxContents: clean(currentBox) };

  return (
    <div className={styles.contentTab}>
      <SaveBar
        content={query.data}
        dirty={dirty}
        saving={save.isPending}
        onCancel={reset}
        onSave={submit}
        onPreview={() => setPreview(true)}
      />
      <div className={`${styles.columns} ${styles.contentLayout}`}>
        <div className={styles.mainColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHead}><div><h2>{t('alanding.headline')}</h2><p>{t('alanding.headlineHint')}</p></div></div>
            {([['alanding.name', product.name], ['alanding.subtitle', product.subtitle ?? '—']] as const).map(([label, value]) => (
              <div key={label}>
                <p className={styles.fieldLabel}>{t(label)}</p>
                <p className={styles.lockedField}><span>{value}</span><span><Lock aria-hidden />{t('alanding.locked')}</span></p>
              </div>
            ))}
          </section>

          <section className={styles.panel} data-testid="highlights-editor">
            <div className={styles.panelHead}><div><h2>{t('alanding.highlights')}</h2><p>{t('alanding.highlightsHint')}</p></div></div>
            <LineList
              lines={currentHighlights}
              label={(index) => t('alanding.highlight', { index })}
              placeholder={t('alanding.highlightPlaceholder')}
              removeLabel={(index) => t('alanding.removeHighlight', { index })}
              onChange={setHighlights}
              touched={touched}
            />
            {currentHighlights.length < 3 ? (
              <button type="button" className={styles.addRow} onClick={() => setHighlights([...currentHighlights, ''])}><Plus aria-hidden />{t('alanding.addHighlight')}</button>
            ) : null}
            {touched && tooFew ? <p className={styles.fieldError} role="alert">{t('alanding.highlightsMin')}</p> : null}
          </section>

          <section className={styles.panel} data-testid="box-editor">
            <div className={styles.panelHead}>
              <div><h2>{t('alanding.box')}</h2><p>{t('alanding.boxHint')}</p></div>
              {currentBox.length < 20 ? <button type="button" className={styles.textButton} onClick={() => setBox([...currentBox, ''])}><Plus aria-hidden />{t('alanding.addBox')}</button> : null}
            </div>
            <LineList
              lines={currentBox}
              label={(index) => t('alanding.boxItem', { index })}
              placeholder={t('alanding.boxPlaceholder')}
              removeLabel={(index) => t('alanding.removeBox', { index })}
              onChange={setBox}
              touched={touched}
            />
          </section>
        </div>
        <div className={styles.sideColumn}>
          <SideCard title={t('alanding.view')} hint={t('alanding.viewHint')}>
            <button type="button" className={styles.blockButton} onClick={() => setPreview(true)}><Smartphone aria-hidden />{t('aoffer.preview')}</button>
          </SideCard>
          <SideCard title={t('alanding.adRules')} hint={t('alanding.adRulesHint')}>
            <ul className={styles.ruleList}>
              {(['moderation.rule.cure', 'moderation.rule.reviews', 'moderation.rule.discount'] as const).map((rule) => <li key={rule}><ShieldCheck aria-hidden />{t(rule)}</li>)}
              <li><ShieldCheck aria-hidden /><span>{t('alanding.badRule')} <span className={styles.mutedInline}>— {product.isBad ? t('alanding.badRuleHint') : t('moderation.rule.notMedicineNa')}</span></span></li>
            </ul>
          </SideCard>
        </div>
      </div>
      {preview ? <LandingPreviewDialog product={product} creatives={creatives} content={previewContent} pricing={pricing} onClose={() => setPreview(false)} /> : null}
    </div>
  );
}
