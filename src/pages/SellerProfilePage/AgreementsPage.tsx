import { App, Skeleton } from 'antd';
import { CircleCheck, Download, FileText, LoaderCircle, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { downloadLegalDocumentPdf, type LegalDocument } from '../../features/sellerAuth/api/sellerAuthApi';
import { useLegalDocumentQuery } from '../../features/sellerAuth/api/useLegalDocumentQuery';
import { LegalDocumentModal } from '../../features/sellerAuth/ui/LegalDocumentModal';
import { useAcceptAgreementMutation, useSellerProfileQuery } from '../../features/sellerProfile/api/sellerProfileApi';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import e from './profileE.module.css';

/**
 * «Oferta va roziliklar» (sotuvchi-oferta): qabul qilingan versiya va vaqt, asosiy shartlar,
 * versiyalar tarixi va roziliklar. Matn — EQ-10 (yurist), shu yerdan o'qiladi.
 */
export default function AgreementsPage() {
  const { t } = useTranslation();
  const profile = useSellerProfileQuery();
  const offer = useLegalDocumentQuery('affiliate-offer');
  const consent = useLegalDocumentQuery('personal-data-consent');
  const { message } = App.useApp();
  const [reading, setReading] = useState<LegalDocument['type'] | null>(null);
  const [downloading, setDownloading] = useState(false);
  const accept = useAcceptAgreementMutation();

  const failed = (profile.isError && !profile.data) || (offer.isError && !offer.data);
  if (failed) {
    return (
      <LoadError
        error={profile.error ?? offer.error}
        onRetry={() => {
          void profile.refetch();
          void offer.refetch();
        }}
      />
    );
  }
  if (!profile.data || !offer.data) return <Skeleton active paragraph={{ rows: 8 }} />;

  const agreements = profile.data.agreements;
  const currentOffer = agreements.find((item) => item.type === 'affiliate-offer' && item.current);
  // Platforma yangi versiya e'lon qilgan, sotuvchi hali qabul qilmagan (sotuvchi-bosh banneri shu yerga olib keladi).
  const newVersion = currentOffer && currentOffer.version !== offer.data.version ? offer.data.version : null;
  const downloadPdf = () => {
    if (!offer.data) return;
    setDownloading(true);
    downloadLegalDocumentPdf('affiliate-offer', offer.data.version)
      .catch((error: unknown) => void message.error(`${t('agreements.pdfFailed')}: ${getApiErrorMessage(error)}`))
      .finally(() => setDownloading(false));
  };
  const acceptNewVersion = (type: LegalDocument['type']) => {
    const document = type === 'affiliate-offer' ? offer.data : consent.data;
    if (!document) return;
    accept.mutate(
      { type, version: document.version },
      {
        onSuccess: () => {
          setReading(null);
          void message.success(t('agreements.acceptedNew', { version: document.version }));
        },
        onError: (error) => void message.error(getApiErrorMessage(error)),
      },
    );
  };
  const offerHistory = agreements.filter((item) => item.type === 'affiliate-offer');
  const documentName = (type: LegalDocument['type']) => (type === 'affiliate-offer' ? t('agreements.offerName') : t('agreements.consentName'));
  const effective = offer.data.effectiveAt ? tashkentDateTime(offer.data.effectiveAt).slice(0, 10) : null;
  const effectiveCell = effective ?? <span className={e.secondary}>{t('agreements.pending')}</span>;
  const readButton = (type: LegalDocument['type'], label: string) => (
    <button type="button" className={e.textBtn} aria-label={t('agreements.readAria', { name: label })} onClick={() => setReading(type)}>
      <FileText aria-hidden />
      {t('agreements.readShort')}
    </button>
  );
  const okChip = (label: string) => (
    <span className={e.chip} data-tone="success"><CircleCheck aria-hidden />{label}</span>
  );

  return (
    <div className={e.page}>
      <div className={e.cols}>
        <div className={e.colMain}>
          <section className={e.card} aria-labelledby="agreements-offer">
            <div className={e.docHead}>
              <span className={e.docIcon} aria-hidden><ScrollText /></span>
              <div className={e.docText}>
                <h2 id="agreements-offer" className={e.docTitle}>{t('agreements.offerName')}</h2>
                <span className={e.docLead}>{t('agreements.offerLead')}</span>
              </div>
              {newVersion ? (
                <span className={e.chip} data-tone="warning">{t('agreements.newVersionTitle', { version: newVersion })}</span>
              ) : currentOffer ? okChip(t('agreements.accepted')) : null}
            </div>
            {newVersion && currentOffer ? (
              <div className={e.status} role="status">
                <strong>{t('agreements.newVersionTitle', { version: t('register.version', { version: newVersion }) })}</strong>
                <span className={e.sub}>{t('agreements.newVersionText', { accepted: currentOffer.version })}</span>
              </div>
            ) : null}
            <dl className={e.rows}>
              <div className={e.row}>
                <dt className={e.rowLabel}>{t('agreements.version')}</dt>
                <dd className={e.rowValue}>
                  <span className={e.rowMain}>
                    <span className={e.val}>{t('register.version', { version: offer.data.version })}</span>
                    <span className={e.sub}>{t('agreements.current')}</span>
                  </span>
                </dd>
              </div>
              <div className={e.row}>
                <dt className={e.rowLabel}>{t('agreements.youAccepted')}</dt>
                <dd className={e.rowValue}>
                  <span className={e.rowMain}>
                    <span className={e.val}>{currentOffer ? tashkentDateTime(currentOffer.acceptedAt) : '—'}</span>
                    <span className={e.sub}>{t('agreements.atRegistration')}</span>
                  </span>
                </dd>
              </div>
              <div className={e.row}>
                <dt className={e.rowLabel}>{t('agreements.effective')}</dt>
                <dd className={e.rowValue}>
                  <span className={e.rowMain}>
                    <span className={effective ? e.val : `${e.val} ${e.placeholder}`}>{effective ?? t('agreements.pending')}</span>
                  </span>
                </dd>
              </div>
            </dl>
            <div className={e.actions}>
              <button type="button" className={newVersion ? `${e.btn} ${e.btnPrimary}` : e.btn} onClick={() => setReading('affiliate-offer')}>
                <FileText aria-hidden />
                {newVersion ? t('agreements.readAccept') : t('agreements.read')}
              </button>
              <button type="button" className={e.btn} onClick={downloadPdf} disabled={downloading} aria-busy={downloading || undefined}>
                {downloading ? <LoaderCircle className={e.spin} aria-hidden /> : <Download aria-hidden />}
                {t('agreements.downloadPdf')}
              </button>
            </div>
          </section>
        </div>

        <div className={e.colSide}>
          <section className={e.card} data-gap="8" aria-labelledby="agreements-summary">
            <div className={e.sectionHead}>
              <div>
                <h2 id="agreements-summary" className={e.h2}>{t('register.summaryTitle')}</h2>
                <p className={e.lead}>{t('agreements.summaryLead')}</p>
              </div>
            </div>
            <dl className={e.stack}>
              {offer.data.summary.map((item) => (
                <div key={item.term}>
                  <dt>{item.term}</dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <section className={e.card} data-gap="12" aria-labelledby="agreements-history">
        <div className={e.sectionHead}>
          <div>
            <h2 id="agreements-history" className={e.h2}>{t('agreements.historyTitle')}</h2>
            <p className={e.lead}>{t('agreements.historyLead')}</p>
          </div>
        </div>
        <div className={e.tableWrap}>
          <table className={e.table}>
            <caption>{t('agreements.historyTitle')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('agreements.version')}</th>
                <th scope="col">{t('agreements.published')}</th>
                <th scope="col">{t('agreements.youAccepted')}</th>
                <th scope="col">{t('agreements.status')}</th>
                <th scope="col">{t('agreements.text')}</th>
              </tr>
            </thead>
            <tbody>
              {offerHistory.map((row) => (
                <tr key={`${row.type}:${row.version}`}>
                  <td><span className={e.strong}>{t('register.version', { version: row.version })}</span></td>
                  <td>{row.version === offer.data.version ? effectiveCell : '—'}</td>
                  <td>{tashkentDateTime(row.acceptedAt)}</td>
                  <td>{row.current ? okChip(t('agreements.statusCurrent')) : <span className={e.chip} data-tone="neutral">{t('agreements.statusOld')}</span>}</td>
                  <td>{row.current ? readButton('affiliate-offer', t('register.version', { version: row.version })) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={e.note}>{t('agreements.newVersionNote')}</p>
      </section>

      <section className={e.card} data-gap="12" aria-labelledby="agreements-consents">
        <div className={e.sectionHead}>
          <div>
            <h2 id="agreements-consents" className={e.h2}>{t('agreements.consentsTitle')}</h2>
            <p className={e.lead}>{t('agreements.consentsLead')}</p>
          </div>
        </div>
        <div className={e.tableWrap}>
          <table className={e.table}>
            <caption>{t('agreements.consentsTitle')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('agreements.document')}</th>
                <th scope="col">{t('agreements.version')}</th>
                <th scope="col">{t('agreements.accepted')}</th>
                <th scope="col">{t('agreements.status')}</th>
                <th scope="col">{t('agreements.text')}</th>
              </tr>
            </thead>
            <tbody>
              {agreements.filter((item) => item.current).map((row) => (
                <tr key={`${row.type}:${row.version}`}>
                  <td><span className={e.strong}>{documentName(row.type)}</span></td>
                  <td>{row.version}</td>
                  <td>{tashkentDateTime(row.acceptedAt)}</td>
                  <td>{okChip(t('agreements.inForce'))}</td>
                  <td>{readButton(row.type, documentName(row.type))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <LegalDocumentModal
        document={reading === 'affiliate-offer' ? offer.data : reading === 'personal-data-consent' ? consent.data ?? null : null}
        onClose={() => setReading(null)}
        // Yangi versiya qabul qilinmagan bo'lsa — oynada «Qabul qilaman».
        onAccept={newVersion && reading === 'affiliate-offer' ? acceptNewVersion : undefined}
      />
    </div>
  );
}
