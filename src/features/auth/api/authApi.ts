import { httpClient } from '../../../shared/api/httpClient';
import type { AuthUser, LoginCredentials, LoginResponse } from '../model/authTypes';

interface LoginApiResponse {
  accessToken?: unknown;
  user?: unknown;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'fullName' in value &&
    typeof value.fullName === 'string' &&
    'phone' in value &&
    typeof value.phone === 'string'
  );
}

function parseLoginResponse(data: LoginApiResponse): LoginResponse {
  if (typeof data.accessToken !== 'string' || !isAuthUser(data.user)) {
    throw new Error('Serverdan kutilmagan javob olindi');
  }

  return {
    accessToken: data.accessToken,
    user: data.user,
  };
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const { data } = await httpClient.post<LoginApiResponse>('/auth/login', credentials);

  return parseLoginResponse(data);
}
