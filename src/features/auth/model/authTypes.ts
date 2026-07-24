export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
}

export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
