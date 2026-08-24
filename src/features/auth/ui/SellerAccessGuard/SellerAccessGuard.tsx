import { App } from 'antd';
import { Outlet } from 'react-router-dom';
import { useAppSelector } from '../../../../app/store/hooks';
import { ContentState } from '../../../../shared/ui/ContentState/ContentState';
import { selectAuthUser } from '../../model/authSlice';
import { canAccessSellerCabinet } from '../../lib/sellerAccess';
import { useLogoutMutation } from '../../api/useLogoutMutation';

export function SellerAccessGuard({ children }: { children?: React.ReactNode }) {
  const { message } = App.useApp();
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

  return children ?? <Outlet />;
}
