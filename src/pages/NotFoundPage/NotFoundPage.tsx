import { Button } from 'antd';
import { SearchX } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { getRoleHome } from '../../app/router/routeAccess';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { ROLE_LABEL_KEYS } from '../../features/auth/lib/roleLabels';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatDateTime } from '../../shared/lib/date';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { StatusPanel, StatusPanelChip } from '../../shared/ui/StatusPanel/StatusPanel';

/** Eski do'kon havolalari (`/dokon/:slug`, `/mahsulot/:id`) panelda yopilgan (umumiy-404). */
const OLD_SHOP_LINK = /^\/(dokon|mahsulot)(\/|$)/;

/** 404 — panel ichida: menyu va yuqori qator joyida qoladi (umumiy-404). */
export default function NotFoundPage() {
  const { locale, t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);
  usePageTitle(t('notFound.title'));

  const oldShopLink = OLD_SHOP_LINK.test(pathname) && user?.role === 'AFFILIATE';
  const home = user ? getRoleHome(user.role) : '/';
  const goBack = () => {
    const index: unknown = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof index === 'number' && index > 0) void navigate(-1);
    else void navigate(home, { replace: true });
  };

  return (
    <StatusPanel
      testId="not-found-page"
      icon={<SearchX />}
      code={t(oldShopLink ? 'notFound.oldShopCode' : 'notFound.code')}
      heading={t(oldShopLink ? 'notFound.oldShopHeading' : 'notFound.heading')}
      text={t(oldShopLink ? 'notFound.oldShopText' : 'notFound.text')}
      actions={oldShopLink ? <>
        <Button type="primary" onClick={() => void navigate('/affiliate/offers')}>{t('notFound.toOffers')}</Button>
        <Button onClick={() => void navigate('/affiliate/pages')}>{t('nav.myPages')}</Button>
      </> : <>
        <Button type="primary" onClick={() => void navigate(home)}>{t('forbidden.home')}</Button>
        <Button type="text" onClick={goBack}>{t('notFound.back')}</Button>
      </>}
      aside={user ? {
        title: t('attempt.title'),
        rows: [
          { label: t('attempt.address'), value: <StatusPanelChip>{pathname}</StatusPanelChip> },
          { label: t('attempt.account'), value: `${user.name} · ${t(ROLE_LABEL_KEYS[user.role])}` },
          { label: t('attempt.time'), value: formatDateTime(new Date().toISOString(), locale) },
        ],
      } : undefined}
    />
  );
}
