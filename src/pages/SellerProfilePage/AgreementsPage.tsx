import { App, Button, Skeleton, Table, Tag } from 'antd';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { downloadLegalDocumentPdf, type LegalDocument } from '../../features/sellerAuth/api/sellerAuthApi';
import { useLegalDocumentQuery } from '../../features/sellerAuth/api/useLegalDocumentQuery';
import { LegalDocumentModal } from '../../features/sellerAuth/ui/LegalDocumentModal';
import { useAcceptAgreementMutation, useSellerProfileQuery, type AgreementAcceptance } from '../../features/sellerProfile/api/sellerProfileApi';
import { getApiErrorMessage } from '../../shared/api/apiError';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { tashkentDateTime } from '../../shared/lib/tashkentTime';
import { LoadError } from '../../shared/ui/LoadError/LoadError';
import styles from './sellerProfile.module.css';

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
        variant="page"
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
  const effective = offer.data.effectiveAt ? tashkentDateTime(offer.data.effectiveAt).slice(0, 10) : t('agreements.pending');
  const readButton = (type: LegalDocument['type']) => (
    <Button size="small" aria-label={t('agreements.readAria', { name: documentName(type) })} onClick={() => setReading(type)}>
      {t('agreements.readShort')}
    </Button>
  );

  return (
    <div className={styles.page}>
      <section className={styles.card} aria-labelledby="agreements-offer">
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 id="agreements-offer">{t('agreements.offerName')}</h2>
            <p className={styles.muted}>{t('agreements.offerLead')}</p>
          </div>
          {newVersion ? <Tag color="warning">{t('agreements.newVersionTitle', { version: newVersion })}</Tag> : currentOffer ? <Tag color="success">{t('agreements.accepted')}</Tag> : null}
        </header>
        {newVersion && currentOffer ? (
          <div className={styles.reason} role="status">
            <strong>{t('agreements.newVersionTitle', { version: t('register.version', { version: newVersion }) })}</strong>
            <span className={styles.muted}>{t('agreements.newVersionText', { accepted: currentOffer.version })}</span>
          </div>
        ) : null}
        <dl className={styles.fields}>
          <div>
            <dt>{t('agreements.version')}</dt>
            <dd>{t('register.version', { version: offer.data.version })} <span className={styles.muted}>{t('agreements.current')}</span></dd>
          </div>
          <div>
            <dt>{t('agreements.youAccepted')}</dt>
            <dd>{currentOffer ? tashkentDateTime(currentOffer.acceptedAt) : '—'}</dd>
            <dd className={styles.muted}>{t('agreements.atRegistration')}</dd>
          </div>
          <div>
            <dt>{t('agreements.effective')}</dt>
            <dd>{effective}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Button type="primary" onClick={() => setReading('affiliate-offer')}>{newVersion ? t('agreements.readAccept') : t('agreements.read')}</Button>
          <Button icon={<Download size={16} />} loading={downloading} onClick={downloadPdf}>{t('agreements.downloadPdf')}</Button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="agreements-summary">
        <div className={styles.headText}>
          <h2 id="agreements-summary" className={styles.subTitle}>{t('register.summaryTitle')}</h2>
          <span className={styles.muted}>{t('agreements.summaryLead')}</span>
        </div>
        <dl className={styles.summary}>
          {offer.data.summary.map((item) => (
            <div key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="agreements-history">
        <div className={styles.headText}>
          <h2 id="agreements-history" className={styles.subTitle}>{t('agreements.historyTitle')}</h2>
          <span className={styles.muted}>{t('agreements.historyLead')}</span>
        </div>
        <Table<AgreementAcceptance>
          size="middle"
          rowKey={(row) => `${row.type}:${row.version}`}
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={offerHistory}
          columns={[
            { title: t('agreements.version'), key: 'version', render: (_: unknown, row) => t('register.version', { version: row.version }) },
            { title: t('agreements.effective'), key: 'effective', render: (_: unknown, row) => (row.version === offer.data.version ? effective : '—') },
            { title: t('agreements.youAccepted'), key: 'accepted', render: (_: unknown, row) => tashkentDateTime(row.acceptedAt) },
            { title: t('agreements.status'), key: 'status', render: (_: unknown, row) => <Tag color={row.current ? 'success' : 'default'}>{row.current ? t('agreements.statusCurrent') : t('agreements.statusOld')}</Tag> },
            { title: t('agreements.text'), key: 'text', render: (_: unknown, row) => (row.current ? readButton('affiliate-offer') : '—') },
          ]}
        />
        <p className={styles.note}>{t('agreements.newVersionNote')}</p>
      </section>

      <section className={styles.card} aria-labelledby="agreements-consents">
        <div className={styles.headText}>
          <h2 id="agreements-consents" className={styles.subTitle}>{t('agreements.consentsTitle')}</h2>
          <span className={styles.muted}>{t('agreements.consentsLead')}</span>
        </div>
        <Table<AgreementAcceptance>
          size="middle"
          rowKey={(row) => `${row.type}:${row.version}`}
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={agreements.filter((item) => item.current)}
          columns={[
            { title: t('agreements.document'), key: 'document', render: (_: unknown, row) => documentName(row.type) },
            { title: t('agreements.version'), dataIndex: 'version' },
            { title: t('agreements.accepted'), key: 'accepted', render: (_: unknown, row) => tashkentDateTime(row.acceptedAt) },
            { title: t('agreements.status'), key: 'status', render: () => <Tag color="success">{t('agreements.inForce')}</Tag> },
            { title: t('agreements.text'), key: 'text', render: (_: unknown, row) => readButton(row.type) },
          ]}
        />
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
