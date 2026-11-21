import { Upload } from 'lucide-react';
import { useState } from 'react';
import { useCreativesQuery } from '../../../features/adminProducts/api/adminProductsQueries';
import type { AdminProduct, Creative } from '../../../features/adminProducts/model/adminProductTypes';
import { CreativeLibrary, UploadButton } from '../../../features/adminProducts/ui/CreativeLibrary';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { LoadError } from '../../../shared/ui/LoadError/LoadError';
import { PageActionBar } from '../../../shared/ui/PageActionBar/PageActionBar';
import { usePhoneActionBar } from '../../../shared/ui/PageActionBar/usePhoneActionBar';
import { CreativeDeleteDialogs } from './CreativeDialogsHost';
import styles from '../AdminProductDetailPage.module.css';

/** «Kreativlar» yorlig'i (admin-offer 2): shu kutubxona ro'yxat ko'rinishida — turi, hajmi, yuklangan vaqt, amallar. */
export function CreativesTab({ product }: { product: AdminProduct }) {
  const { t } = useTranslation();
  const phone = usePhoneActionBar();
  const query = useCreativesQuery(product.id);
  const creatives = query.data ?? [];
  const [upload, setUpload] = useState(false);
  const [deleting, setDeleting] = useState<Creative | null>(null);
  const videos = creatives.filter((item) => item.type === 'VIDEO').length;
  return (
    <>
      <section className={styles.panel} data-testid="creatives-tab">
        <div className={styles.panelHead}>
          <div>
            <h2>{t('creatives.title')}</h2>
            <p>{t('creatives.hint')}</p>
          </div>
          {phone ? null : <UploadButton onClick={() => setUpload(true)} />}
        </div>
        <p className={styles.caption}>{t('aoffer.libraryCount', { videos, images: creatives.length - videos })}</p>
        {query.isError ? <LoadError error={query.error} onRetry={() => void query.refetch()} variant="row" /> : creatives.length ? (
          <CreativeLibrary creatives={creatives} view="list" onOpen={(creative) => window.open(creative.url, '_blank', 'noopener,noreferrer')} onDelete={setDeleting} />
        ) : <p className={styles.muted}>{t('aoffer.libraryEmpty')}</p>}
        <p className={styles.fieldHint}>{t('aoffer.libraryNote')}</p>
        <CreativeDeleteDialogs product={product} creatives={creatives} upload={upload} deleting={deleting} onClose={() => { setUpload(false); setDeleting(null); }} />
      </section>
      <PageActionBar>
        <button type="button" className={styles.barPrimary} onClick={() => setUpload(true)}><Upload aria-hidden />{t('aoffer.upload')}</button>
      </PageActionBar>
    </>
  );
}
