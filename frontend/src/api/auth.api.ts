import api from './client';
import type { User } from '@/types';

export interface AuthPayload {
  user: User;
  accessToken: string;
}

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
    const { data } = await api.post('/auth/refresh');
    return data.data as AuthPayload;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
