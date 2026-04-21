<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const code = ref('');
const error = ref<string | null>(null);
const loading = ref(false);
const resent = ref(false);

async function submit() {
  error.value = null;
  loading.value = true;
  try {
    await auth.verifyTwoFactor(code.value);
    router.push('/');
  } catch (e: any) {
    const reason = e?.body?.reason;
    const map: Record<string, string> = {
      expired: 'Code expired. Request a new one.',
      wrong: 'Incorrect code.',
      consumed: 'Code already used. Request a new one.',
      locked: 'Too many attempts. Request a new code.',
      not_found: 'No active code. Request a new one.',
    };
    error.value = map[reason] || e?.message || 'Verification failed.';
  } finally {
    loading.value = false;
  }
}

async function resend() {
  error.value = null;
  resent.value = false;
  try {
    await auth.resendTwoFactor();
    resent.value = true;
  } catch (e: any) {
    error.value = e?.message || 'Could not send a new code.';
  }
}
</script>

<template>
  <v-main>
    <v-container class="fill-height d-flex align-center justify-center">
      <v-card class="pa-4" max-width="420" width="100%">
        <v-card-title>Two-factor authentication</v-card-title>
        <v-card-subtitle>
          Enter the 6-digit code we emailed to
          <b v-if="auth.pendingEmail">{{ auth.pendingEmail }}</b>.
          Codes expire in 5 minutes.
        </v-card-subtitle>
        <v-card-text>
          <v-form @submit.prevent="submit">
            <v-text-field
              v-model="code"
              label="Code"
              variant="outlined"
              inputmode="numeric"
              maxlength="6"
              autofocus
            />
            <v-alert v-if="error" type="error" density="compact" class="mb-3">{{ error }}</v-alert>
            <v-alert v-else-if="resent" type="info" density="compact" class="mb-3">
              A new code has been sent.
            </v-alert>
            <v-btn type="submit" color="primary" block :loading="loading">Verify &amp; continue</v-btn>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="resend">Resend code</v-btn>
          <v-spacer />
          <v-btn variant="text" to="/login">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-container>
  </v-main>
</template>
