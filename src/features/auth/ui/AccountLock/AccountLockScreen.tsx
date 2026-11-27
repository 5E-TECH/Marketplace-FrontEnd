import { Ban, FileText, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../../shared/lib/personName';
import { BareButton, BareFacts, BareLayout, BarePending, BareSection, BareText } from '../../../../shared/ui/BareLayout/BareLayout';
import { useLegalDocumentQuery } from '../../../sellerAuth/api/useLegalDocumentQuery';
import { LegalDocumentModal } from '../../../sellerAuth/ui/LegalDocumentModal';
import { isSellerLock, type AccountLock } from '../../lib/accountLock';
import { lockAccountLine, lockDate, lockHeldText, lockSum } from '../../lib/accountLockView';

type Row = { key: string; label: string; value: string | null };
const shown = (rows: Row[]) => rows.filter((row): row is { key: string; label: string; value: string } => Boolean(row.value));

/**
 * Karkassiz «Hisobingiz bloklangan» (umumiy-sessiya 7, 8, 15). Sotuvchi: sabab, dalil, asos, pul, sahifalar va
 * e'tiroz yo'li, «Ofertani o‘qish». Xodim: kim, qachon, sabab, nazoratchi. Nofaol hisob (chizilmagan) — xodim
 * ko'rinishida, nazoratchi qarori. Backend bermagan qatorlar ko'rsatilmaydi.
 */
export function AccountLockScreen({ lock, onSignOut }: { lock: AccountLock; onSignOut: () => void }) {
  const { t } = useTranslation();
  const [offerOpen, setOfferOpen] = useState(false);
  const seller = isSellerLock(lock);
  const inactive = lock.kind === 'INACTIVE';
  const date = lockDate(lock);
  const account = { key: 'account', label: t('lock.account'), value: lockAccountLine(lock, t) };
  const supervisor = { key: 'supervisor', label: t('lock.supervisor'), value: lock.supervisorName ? shortPersonName(lock.supervisorName) : null };

  const signOut = <BareButton key="out" icon={<LogOut aria-hidden />} onClick={onSignOut}>{t('lock.signOut')}</BareButton>;

  if (!seller) {
    return (
      <BareLayout
        icon={<Ban />}
        tone="danger"
        title={t(inactive ? 'lock.page.inactiveTitle' : 'lock.page.blockedTitle')}
        lead={t(inactive ? 'lock.page.inactiveLead' : 'lock.page.staffLead')}
        actions={signOut}
        testId="account-lock-page"
      >
        <BareFacts
          items={shown([
            account,
            { key: 'at', label: t(inactive ? 'lock.inactiveAt' : 'lock.blockedAt'), value: date },
            { key: 'reason', label: t('lock.reason'), value: lock.reason },
            supervisor,
          ])}
        />
      </BareLayout>
    );
  }

  const held = lockHeldText(lock, t);
  const balance = lock.seller?.balance ?? null;
  const money = shown([
    { key: 'held', label: t('lock.held'), value: held },
    { key: 'balance', label: t('lock.balance'), value: balance === null ? null : lockSum(balance, t) },
  ]);
  return (
    <BareLayout
      icon={<Ban />}
      tone="danger"
      title={t('lock.page.blockedTitle')}
      lead={date ? t('lock.page.sellerLead', { date }) : t('lock.page.sellerLeadNoDate')}
      actions={[
        <BareButton key="offer" icon={<FileText aria-hidden />} onClick={() => setOfferOpen(true)}>{t('lock.readOffer')}</BareButton>,
        signOut,
      ]}
      testId="account-lock-page"
    >
      <BareFacts
        items={shown([
          account,
          { key: 'reason', label: t('lock.reason'), value: lock.reason },
          { key: 'evidence', label: t('lock.evidence'), value: lock.evidence },
          { key: 'basis', label: t('lock.basis'), value: lock.basis },
        ])}
      />
      {money.length ? (
        <BareSection title={t('lock.money')}>
          <BareFacts items={money} />
        </BareSection>
      ) : null}
      {lock.seller?.pagesStopped ? (
        <BareSection title={t('lock.pages')}>
          <BareText>{t('lock.pagesText')}</BareText>
        </BareSection>
      ) : null}
      <BareSection title={t('lock.appeal')}>
        <BareText>{t('lock.appealText')} <BarePending>{t('lock.appealTbd')}</BarePending></BareText>
      </BareSection>
      {offerOpen ? <OfferModal onClose={() => setOfferOpen(false)} /> : null}
    </BareLayout>
  );
}

/** Oferta matni ochiq endpointdan (sessiyasiz) — ro'yxatdagi oyna (EQ-10). */
function OfferModal({ onClose }: { onClose: () => void }) {
  const offer = useLegalDocumentQuery('affiliate-offer');
  return <LegalDocumentModal document={offer.data ?? null} onClose={onClose} />;
}
