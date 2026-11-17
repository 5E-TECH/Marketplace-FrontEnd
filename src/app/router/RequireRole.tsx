import type { ReactNode } from 'react';
import { useAppSelector } from '../store/hooks';
import { selectAuthUser } from '../../features/auth/model/authSlice';
import { ForbiddenPage } from '../../pages/ForbiddenPage/ForbiddenPage';
import { PageLoader } from '../../shared/ui/PageLoader/PageLoader';
import type { AppRoute } from './routeManifest';

interface RequireRoleProps {
  route: AppRoute;
  children: ReactNode;
}

/**
 * Marshrutning rol himoyasi. Boshqa rolga yo'naltirish emas, 403 sahifa:
 * foydalanuvchi o'z karkasida qoladi va nima uchun ochilmaganini ko'radi.
 * Sahifa komponenti ham, uning so'rovlari ham ishga tushmaydi.
 */
export function RequireRole({ route, children }: RequireRoleProps) {
  const user = useAppSelector(selectAuthUser);

  // ProtectedRoute profilni yuklamaguncha bu yerga yetib kelmaydi; ehtiyot uchun.
  if (!user) return <PageLoader compact />;
  if (route.roles.includes(user.role)) return children;
  return <ForbiddenPage route={route} />;
}
