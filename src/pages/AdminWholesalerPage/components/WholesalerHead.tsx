import { Dropdown, Tooltip } from 'antd';
import { CirclePlay, ClipboardCheck, Ellipsis, EllipsisVertical, FileCheck, FileUp, PackagePlus, Plus, Send, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cabinetState, hasContract, productBlock } from '../../../features/wholesalers/lib/wholesalerRules';
import type { Wholesaler } from '../../../features/wholesalers/model/wholesalerTypes';
import type { TranslationKey } from '../../../shared/i18n/translations';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { Badge, DotLabel } from '../../../shared/ui/Badge/Badge';
import rowMenu from '../../../shared/ui/RowMenu/RowMenu.module.css';
import { StatusBadge } from '../../../shared/ui/StatusBadge/StatusBadge';
import { headMenuItems, headMeta, type HeadAction } from '../model/headMenu';
import styles from '../AdminWholesalerPage.module.css';

interface HeadProps {
  wholesaler: Wholesaler;
  /** Planshet va telefon: «Aktni yuborish» menyuga o'tadi. */
  compact: boolean;
  phone: boolean;
  onAction: (action: HeadAction) => void;
  onPhoneMenu: () => void;
}

/** Sarlavhadagi belgilar: holat, shartnoma, kabinet (nuqta bilan). */
export function HeadBadges({ wholesaler }: { wholesaler: Wholesaler }) {
  const { t } = useTranslation();
  const cabinet = wholesaler.status === 'SUSPENDED' ? 'CLOSED' : cabinetState(wholesaler);
  return (
    <>
      <StatusBadge family="wholesaler" code={wholesaler.status} />
      {hasContract(wholesaler)
        ? <Badge tone="success" icon={FileCheck}>{t('whk.head.signed')}</Badge>
        : <Badge tone="warning" icon={TriangleAlert}>{t('whs.card.contractMissing')}</Badge>}
      <DotLabel tone={cabinet === 'ACTIVE' ? 'success' : cabinet === 'INVITED' ? 'warning' : 'neutral'}>{t(`whk.head.cabinet.${cabinet}` as TranslationKey)}</DotLabel>
    </>
  );
}

/**
 * Optovik kartasi sarlavhasi (admin-optovik-karta): holat, shartnoma va kabinet, rekvizit qisqachasi, amallar —
 * shartnomali faol: «Aktni yuborish», «Mahsulot qo'shish», «Postavka arizasi»; shartnomasiz: mahsulot va postavka
 * o'chiq (sababi maslahatda), «Shartnomani yuklash»; to'xtatilgan: «Faollashtirish»; M2 arizasi: «Arizani ko'rib chiqish».
 */
export function WholesalerHead({ wholesaler, compact, phone, onAction, onPhoneMenu }: HeadProps) {
  const { t } = useTranslation();
  const block = productBlock(wholesaler);
  const suspended = wholesaler.status === 'SUSPENDED';
  const pending = wholesaler.status === 'PENDING';
  const signed = hasContract(wholesaler);
  const reason = block ? t(`whs.block.${block}` as TranslationKey) : null;

  const disabledButton = (key: HeadAction, icon: ReactNode, label: string) => {
    const button = (
      <button type="button" className={styles.secondary} disabled={Boolean(reason)} aria-describedby={reason ? `whk-head-${key}` : undefined} onClick={() => onAction(key)}>
        {icon}{label}
        {reason ? <span id={`whk-head-${key}`} className={styles.visuallyHidden}>{reason}</span> : null}
      </button>
    );
    return reason ? <Tooltip title={reason}><span className={styles.tooltipWrap}>{button}</span></Tooltip> : button;
  };

  const primary = pending
    ? <button type="button" className={styles.primary} onClick={() => onAction('review')}><ClipboardCheck aria-hidden />{t('whk.head.review')}</button>
    : suspended
      ? <button type="button" className={styles.primary} onClick={() => onAction('resume')}><CirclePlay aria-hidden />{t('whs.menu.resume')}</button>
      : signed
        ? <button type="button" className={styles.primary} onClick={() => onAction('declare')}><PackagePlus aria-hidden />{t('whs.declare')}</button>
        : <button type="button" className={styles.primary} onClick={() => onAction('contract')}><FileUp aria-hidden />{t('whk.head.uploadContract')}</button>;

  const items = headMenuItems(wholesaler, compact, t);
  const menu = (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      rootClassName={rowMenu.root}
      menu={{
        items: items.map((item) => ({
          key: item.key,
          icon: item.icon,
          danger: item.danger,
          disabled: Boolean(item.reason),
          label: item.reason ? <Tooltip title={item.reason} placement="left">{item.label}</Tooltip> : item.label,
        })),
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          window.setTimeout(() => onAction(key as HeadAction));
        },
      }}
    >
      <button type="button" className={styles.iconOutline} aria-label={t('whk.head.more')} title={t('whk.head.more')}><Ellipsis aria-hidden /></button>
    </Dropdown>
  );

  return (
    <section className={styles.head} aria-label={t('whk.head.aria')} data-testid="wholesaler-head">
      <div className={styles.headInfo}>
        <div className={styles.headBadges}><HeadBadges wholesaler={wholesaler} /></div>
        <p className={styles.headMeta}>{headMeta(wholesaler, t)}</p>
      </div>
      {phone ? (
        <button type="button" className={styles.iconOutline} aria-label={t('whk.head.more')} onClick={onPhoneMenu}><EllipsisVertical aria-hidden /></button>
      ) : (
        <div className={styles.headActions}>
          {!compact && signed && !suspended && !pending ? <button type="button" className={styles.secondary} onClick={() => onAction('act')}><Send aria-hidden />{t('whs.menu.act')}</button> : null}
          {suspended || pending ? null : disabledButton('addProduct', <Plus aria-hidden />, t('whk.head.addProduct'))}
          {suspended || pending || signed ? null : disabledButton('declare', <PackagePlus aria-hidden />, t('whs.declare'))}
          {primary}
          {menu}
        </div>
      )}
    </section>
  );
}
