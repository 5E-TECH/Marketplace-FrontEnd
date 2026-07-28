import { useAppSelector } from '../../../../app/store/hooks';
import { ContentState } from '../../../../shared/ui/ContentState/ContentState';
import { selectAuthUser } from '../../model/authSlice';

const SELLER_ROLES = new Set(['SELLER', 'ADMIN', 'SUPERADMIN']);

export function SellerAccessGuard({ children }: { children: React.ReactNode }) {
  const user = useAppSelector(selectAuthUser);

  if (!user) {
    return (
      <ContentState
        state="error"
        title="Profil ma’lumoti olinmadi"
        description="Sahifani yangilang yoki qayta tizimga kiring."
      />
    );
  }

  if (!SELLER_ROLES.has(user.role) || user.isDeleted) {
    return <ContentState state="forbidden" />;
  }

  return children;
}
