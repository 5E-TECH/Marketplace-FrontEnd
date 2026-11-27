import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/store/hooks';
import { loggedOut, selectAccountLock } from '../../features/auth/model/authSlice';
import { AccountLockScreen } from '../../features/auth/ui/AccountLock/AccountLockScreen';

/**
 * Karkassiz «Hisobingiz bloklangan» (FE-15, umumiy-sessiya 7–8, 15): oynadagi «Batafsil» yoki sotuvchi SMS kodi bilan
 * kirganda. Ma'lumot — hisob yopilgan paytdagi 401 javobidan; sahifa yangilansa u yo'q — kirish sahifasiga.
 */
export default function AccountBlockedPage() {
  const lock = useAppSelector(selectAccountLock);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  if (!lock) return <Navigate to="/login" replace />;

  const signOut = () => {
    queryClient.clear();
    dispatch(loggedOut({ manual: true }));
    void navigate('/login', { replace: true });
  };

  return <AccountLockScreen lock={lock} onSignOut={signOut} />;
}
