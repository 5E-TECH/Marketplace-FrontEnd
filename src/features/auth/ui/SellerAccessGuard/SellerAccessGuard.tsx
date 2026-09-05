import { App } from 'antd';
import { Outlet } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  canAccessRoute,
  getDefaultRoute,
} from '../../../../app/router/appRouteConfig';
import { useAppSelector } from '../../../../app/store/hooks';
import { ContentState } from '../../../../shared/ui/ContentState/ContentState';
import { selectAuthUser } from '../../model/authSlice';
import { canAccessSellerCabinet } from '../../lib/sellerAccess';
import { useLogoutMutation } from '../../api/useLogoutMutation';

export function SellerAccessGuard({ children }: { children?: React.ReactNode }) {
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppSelector(selectAuthUser);
  const logoutMutation = useLogoutMutation();

  const switchToSeller = () => {
    logoutMutation.mutate(undefined, {
      onError: () =>
        void message.warning(
          'Server sessiyasi yopilmadi, lokal sessiya tozalandi',
        ),
    });
  };

  if (!user) {
    return (
      <ContentState
        state="error"
        title="Profil ma’lumoti olinmadi"
        description="Sahifani yangilang yoki qayta tizimga kiring."
      />
    );
  }

  if (!canAccessSellerCabinet(user)) {
    return (
      <ContentState
        state="forbidden"
        title="Seller akkaunti talab qilinadi"
        description={`Joriy akkaunt roli: ${user.role}. Bu akkaunt kabinetga kirish huquqiga ega emas.`}
        actionLabel="Seller akkaunti bilan kirish"
        onAction={switchToSeller}
      />
    );
  }

  if (!canAccessRoute(location.pathname, user.role)) {
    const fallback = getDefaultRoute(user.role);

    return (
      <ContentState
        state="forbidden"
        title="Bu bo‘lim sizga ochiq emas"
        description={`«${user.role}» roli bu bo‘limda ishlay olmaydi. Sizga ochiq bo‘limga o‘tishingiz mumkin.`}
        actionLabel="Ochiq bo‘limga o‘tish"
        onAction={() => void navigate(fallback, { replace: true })}
      />
    );
  }

  return children ?? <Outlet />;
}
