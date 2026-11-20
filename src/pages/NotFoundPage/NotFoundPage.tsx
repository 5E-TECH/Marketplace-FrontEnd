import { Button } from 'antd';
import { ChevronLeft, FileQuestion } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../app/store/hooks';
import { getNavGroups, getRoleHome } from '../../app/router/routeAccess';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { ROLE_LABEL_KEYS } from '../../features/auth/lib/roleLabels';
import { useTranslation } from '../../shared/i18n/useTranslation';
import { formatDateTime } from '../../shared/lib/date';
import { usePageTitle } from '../../shared/ui/PageHeader/pageTitle';
import { shortPersonName } from '../../shared/lib/personName';
import { StatusPanel, StatusPanelChip, StatusPanelSuggestions } from '../../shared/ui/StatusPanel/StatusPanel';

/** Eski do'kon havolalari (`/dokon/:slug`, `/mahsulot/:id`) panelda yopilgan (umumiy-404). */
const OLD_SHOP_LINK = /^\/(dokon|mahsulot)(\/|$)/;

/** Manzil bo'laklari menyu bandiga o'xshasa — o'sha band birinchi (4 harf bo'yicha), bo'lmasa menyu boshidagilar. */
function suggestionScore(pathname: string, routePath: string): number {
  const tokens = pathname.toLowerCase().split('/').filter((part) => part.length >= 3).map((part) => part.slice(0, 4));
  return routePath.toLowerCase().split('/').filter(Boolean).reduce((score, part) => score + (tokens.some((token) => part.startsWith(token)) ? 1 : 0), 0);
}

/** 404 — panel ichida: menyu va yuqori qator joyida qoladi (umumiy-404). */
export default function NotFoundPage() {
  const { locale, t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);
  usePageTitle(t('notFound.title'));

  const oldShopLink = OLD_SHOP_LINK.test(pathname) && user?.role === 'AFFILIATE';
  const home = user ? getRoleHome(user.role) : '/';
  const suggestions = user && !oldShopLink
    ? getNavGroups(user.role).flatMap((group) => group.routes)
      .map((route, index) => ({ route, index, score: suggestionScore(pathname, route.path) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 2)
      .map(({ route }) => route)
    : [];
  const goBack = () => {
    const index: unknown = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof index === 'number' && index > 0) void navigate(-1);
    else void navigate(home, { replace: true });
  };

  return (
    <StatusPanel
      testId="not-found-page"
      icon={<FileQuestion />}
      code={t(oldShopLink ? 'notFound.oldShopCode' : 'notFound.code')}
      heading={t(oldShopLink ? 'notFound.oldShopHeading' : 'notFound.heading')}
      text={t(oldShopLink ? 'notFound.oldShopText' : 'notFound.text')}
      actions={oldShopLink ? <>
        <Button type="primary" onClick={() => void navigate('/affiliate/offers')}>{t('notFound.toOffers')}</Button>
        <Button onClick={() => void navigate('/affiliate/pages')}>{t('nav.myPages')}</Button>
      </> : <>
        <Button type="primary" onClick={() => void navigate(home)}>{t('forbidden.home')}</Button>
        <Button type="text" icon={<ChevronLeft size={18} />} onClick={goBack}>{t('notFound.back')}</Button>
      </>}
      aside={user ? {
        title: t('attempt.title'),
        rows: [
          { label: t('attempt.address'), value: <StatusPanelChip>{pathname}</StatusPanelChip> },
          { label: t('attempt.account'), value: shortPersonName(user.name) },
          { label: t('attempt.role'), value: t(ROLE_LABEL_KEYS[user.role]) },
          { label: t('attempt.time'), value: formatDateTime(new Date().toISOString(), locale) },
        ],
      } : undefined}
      extra={suggestions.length ? (
        <StatusPanelSuggestions
          title={t('notFound.suggestions')}
          items={suggestions.map((route) => ({ key: route.path, icon: route.navIcon, label: t(route.label), path: route.path, onOpen: () => void navigate(route.path) }))}
        />
      ) : undefined}
    />
  );
}
