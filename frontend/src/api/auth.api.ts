import api, { refreshSession, type RefreshSessionPayload } from './client';

export type AuthPayload = RefreshSessionPayload;

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export const authApi = {
  async register(input: RegisterInput): Promise<AuthPayload> {
    const { data } = await api.post('/auth/register', input);
    return data.data as AuthPayload;
  },

  async login(input: LoginInput): Promise<AuthPayload> {
    const { data } = await api.post('/auth/login', input);
    return data.data as AuthPayload;
  },

  async refresh(): Promise<AuthPayload> {
    // Shared single-flight with the 401 interceptor (see client.ts).
    return refreshSession();
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
