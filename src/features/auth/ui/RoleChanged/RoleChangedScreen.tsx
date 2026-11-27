import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, UserRoundCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRoleHome } from '../../../../app/router/routeAccess';
import { useAppDispatch } from '../../../../app/store/hooks';
import { useTranslation } from '../../../../shared/i18n/useTranslation';
import { shortPersonName } from '../../../../shared/lib/personName';
import { BareButton, BareFacts, BareLayout } from '../../../../shared/ui/BareLayout/BareLayout';
import { momentText } from '../../../staff/lib/staffFormat';
import { ROLE_LABEL_KEYS } from '../../lib/roleLabels';
import { roleChangeSeen } from '../../model/authSlice';
import type { AuthUser, UserRole } from '../../model/authTypes';

/**
 * «Rolingiz o‘zgardi» (umumiy-sessiya 9): o'sha odam qayta kirdi, roli boshqa — eski rol sahifasi ochilmaydi,
 * karkassiz sahifa va «Ish joyini ochish» → yangi rolning bosh sahifasi. «Jamoa» va «O‘zgartirdi» — taklif
 * (`/auth/me` `team`, `roleChange`); kelmasa qatorlar yo'q.
 */
export function RoleChangedScreen({ user, before }: { user: AuthUser; before: UserRole | null }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const change = user.roleChange?.after === user.role ? user.roleChange : null;
  const by = change?.by
    ? [shortPersonName(change.by.name), [change.by.role ? t(ROLE_LABEL_KEYS[change.by.role]).toLocaleLowerCase() : null, change.at ? momentText(change.at) : null].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
    : null;
  const rows = [
    { key: 'before', label: t('roleChanged.before'), value: before ? t(ROLE_LABEL_KEYS[before]) : t('roleChanged.unknown') },
    { key: 'after', label: t('roleChanged.after'), value: t(ROLE_LABEL_KEYS[user.role]) },
    { key: 'team', label: t('roleChanged.team'), value: user.role === 'OPERATOR_LEAD' && user.team ? t('roleChanged.teamValue', { name: shortPersonName(user.team.supervisorName) }) : null },
    { key: 'by', label: t('roleChanged.by'), value: by },
  ].filter((row): row is { key: string; label: string; value: string } => Boolean(row.value));

  const open = () => {
    // Eski rol ma'lumoti keshda qolmasin: yangi ish joyi o'z so'rovlarini yuboradi.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    dispatch(roleChangeSeen());
    void navigate(getRoleHome(user.role), { replace: true });
  };

  return (
    <BareLayout
      icon={<UserRoundCheck />}
      tone="action"
      title={t('roleChanged.title')}
      lead={t('roleChanged.lead')}
      actions={<BareButton primary iconEnd={<ArrowRight aria-hidden />} onClick={open}>{t('roleChanged.open')}</BareButton>}
      testId="role-changed"
    >
      <BareFacts items={rows} />
    </BareLayout>
  );
}
