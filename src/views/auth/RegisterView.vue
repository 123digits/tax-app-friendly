<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const username = ref('');
const email = ref('');
const password = ref('');
const confirm = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

// step 1 = register form; step 2 = verify email code
const step = ref<1 | 2>(1);
const code = ref('');

async function register() {
  error.value = null;
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.';
    return;
  }
  if (password.value !== confirm.value) {
    error.value = 'Passwords do not match.';
    return;
  }
  loading.value = true;
  try {
    await auth.register(username.value, email.value, password.value);
    step.value = 2;
  } catch (e: any) {
    const code = e?.body?.error;
    if (code === 'user_exists') error.value = 'Username or email already in use.';
    else if (code === 'validation_failed') error.value = 'Please check your input.';
    else error.value = e?.message || 'Registration failed.';
  } finally {
    loading.value = false;
  }
}

async function verify() {
  error.value = null;
  loading.value = true;
  try {
    await auth.verifyEmail(email.value, code.value);
    router.push({ name: 'login' });
  } catch (e: any) {
    error.value = e?.message || 'Verification failed.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-main>
    <v-container class="fill-height d-flex align-center justify-center">
      <v-card class="pa-4" max-width="460" width="100%">
        <template v-if="step === 1">
          <v-card-title>Create account</v-card-title>
          <v-card-subtitle>We'll email a 6-digit code to verify your address.</v-card-subtitle>
          <v-card-text>
            <v-form @submit.prevent="register">
              <v-text-field v-model="username" label="Username" variant="outlined" autocomplete="username" />
              <v-text-field v-model="email" label="Email" type="email" variant="outlined" autocomplete="email" />
              <v-text-field v-model="password" label="Password" type="password" variant="outlined" autocomplete="new-password" />
              <v-text-field v-model="confirm" label="Confirm password" type="password" variant="outlined" autocomplete="new-password" />
              <v-alert v-if="error" type="error" density="compact" class="mb-3">{{ error }}</v-alert>
              <v-btn type="submit" color="primary" block :loading="loading">Create account</v-btn>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="text" to="/login">Already have an account?</v-btn>
          </v-card-actions>
        </template>

        <template v-else>
          <v-card-title>Verify email</v-card-title>
          <v-card-subtitle>
            Enter the 6-digit code sent to <b>{{ email }}</b>. Codes expire in 5 minutes.
          </v-card-subtitle>
          <v-card-text>
            <v-form @submit.prevent="verify">
              <v-text-field
                v-model="code"
                label="Verification code"
                variant="outlined"
                inputmode="numeric"
                maxlength="6"
                autofocus
              />
              <v-alert v-if="error" type="error" density="compact" class="mb-3">{{ error }}</v-alert>
              <v-btn type="submit" color="primary" block :loading="loading">Verify</v-btn>
            </v-form>
          </v-card-text>
        </template>
      </v-card>
    </v-container>
  </v-main>
</template>
