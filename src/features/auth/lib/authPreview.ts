import type { AuthUser, LoginResponse } from '../model/authTypes';

export const isAuthPreviewEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_AUTH_PREVIEW === 'true';

export const previewUser: AuthUser = {
  id: 'preview-seller',
  role: 'SELLER',
  name: 'Sotuvchi',
  phone: '+998900000000',
  email: 'seller@markethub.uz',
  avatarUrl: null,
  isActive: true,
  isDeleted: false,
};

export const previewSession: LoginResponse = {
  accessToken: 'preview-access-token',
};
