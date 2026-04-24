<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useTaxReturnStore } from '../stores/taxReturn';

const router = useRouter();
const auth = useAuthStore();
const taxStore = useTaxReturnStore();

const userLabel = computed(() => auth.user?.username ?? '');
const isAdmin = computed(() => !!auth.user?.isAdmin);
const activeYear = computed(() => taxStore.activeYear ?? taxStore.data?.taxYear ?? null);

async function handleLogout() {
  await auth.logout();
  router.push({ name: 'login' });
}

function refundLabel() {
  // Only rendered when taxStore.computed is truthy (see the v-if on the
  // v-chip below), so c is guaranteed non-null here.
  const { refund, balanceDue } = taxStore.computed!.summary;
  if (refund > 0) return `Refund $${refund.toFixed(0)}`;
  if (balanceDue > 0) return `Owe $${balanceDue.toFixed(0)}`;
  return '$0';
}
</script>

<template>
  <v-app-bar color="primary" density="comfortable">
    <v-app-bar-title>
      <router-link to="/" class="text-white text-decoration-none">
        Tax Prep<span v-if="activeYear"> {{ activeYear }}</span>
      </router-link>
    </v-app-bar-title>

    <template #append>
      <v-btn v-if="isAdmin" variant="text" to="/admin" prepend-icon="mdi-shield-account">
        Admin
      </v-btn>
      <v-chip v-if="taxStore.computed" variant="tonal" color="white" class="me-2">
        {{ refundLabel() }}
      </v-chip>
      <span class="me-3">{{ userLabel }}</span>
      <v-btn variant="text" @click="handleLogout">Log out</v-btn>
    </template>
  </v-app-bar>

  <v-main>
    <v-container>
      <slot />
    </v-container>
  </v-main>
</template>
