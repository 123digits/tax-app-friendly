import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { User } from '../../shared/types';
import { api } from '../api/client';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loading = ref(false);
  const twoFactorPending = ref(false);
  const pendingEmail = ref<string | null>(null);

  async function fetchMe() {
    loading.value = true;
    try {
      const r = await api.get<{ user: User }>('/api/auth/me');
      user.value = r.user;
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function register(username: string, email: string, password: string) {
    await api.post('/api/auth/register', { username, email, password });
    pendingEmail.value = email;
  }

  async function verifyEmail(email: string, code: string) {
    await api.post('/api/auth/verify-email', { email, code });
  }

  async function login(username: string, password: string) {
    const r = await api.post<{ ok: boolean; twoFactorRequired: boolean; email: string }>(
      '/api/auth/login',
      { username, password }
    );
    if (r.twoFactorRequired) {
      twoFactorPending.value = true;
      pendingEmail.value = r.email;
    }
    return r;
  }

  async function verifyTwoFactor(code: string) {
    await api.post('/api/auth/two-factor/verify', { code });
    twoFactorPending.value = false;
    pendingEmail.value = null;
    await fetchMe();
  }

  async function resendTwoFactor() {
    await api.post('/api/auth/two-factor/resend');
  }

  async function logout() {
    await api.post('/api/auth/logout');
    user.value = null;
  }

  return {
    user, loading, twoFactorPending, pendingEmail,
    fetchMe, register, verifyEmail, login, verifyTwoFactor, resendTwoFactor, logout,
  };
});
