<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const username = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

async function submit() {
  error.value = null;
  loading.value = true;
  try {
    const r = await auth.login(username.value, password.value);
    if (r.twoFactorRequired) {
      router.push({ name: 'two-factor' });
    } else {
      router.push('/');
    }
  } catch (e: any) {
    error.value = e?.body?.error === 'invalid_credentials'
      ? 'Invalid username or password.'
      : e?.message || 'Login failed.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-main>
    <v-container class="fill-height d-flex align-center justify-center">
      <v-card class="pa-4" max-width="420" width="100%">
        <v-card-title>Sign in</v-card-title>
        <v-card-subtitle>Enter your credentials to continue your 2025 return.</v-card-subtitle>
        <v-card-text>
          <v-form @submit.prevent="submit">
            <v-text-field
              v-model="username"
              label="Username or email"
              variant="outlined"
              autocomplete="username"
              autofocus
            />
            <v-text-field
              v-model="password"
              label="Password"
              type="password"
              variant="outlined"
              autocomplete="current-password"
            />
            <v-alert v-if="error" type="error" density="compact" class="mb-3">{{ error }}</v-alert>
            <v-btn type="submit" color="primary" block :loading="loading">Sign in</v-btn>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" to="/register">Create account</v-btn>
        </v-card-actions>
      </v-card>
    </v-container>
  </v-main>
</template>
