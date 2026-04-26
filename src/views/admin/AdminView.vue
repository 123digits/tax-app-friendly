<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '../../components/AppShell.vue';
import { useAdminStore } from '../../stores/admin';
import { api } from '../../api/client';

const router = useRouter();
const admin = useAdminStore();

interface AdminUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
}

const users = ref<AdminUser[]>([]);
const newYear = ref<number | null>(null);
const cloneSource = ref<number | null>(null);
const cloneTarget = ref<number | null>(null);
const error = ref<string | null>(null);

async function refreshUsers() {
  users.value = await api.get<AdminUser[]>('/api/admin/users');
}

onMounted(async () => {
  await admin.load();
  await refreshUsers();
  if (admin.configs.length) cloneSource.value = admin.configs[0].taxYear;
});

async function createBlank() {
  error.value = null;
  if (!newYear.value) return;
  // Use the most recent config as a template so the new year has sane defaults.
  if (admin.configs.length === 0) {
    error.value = 'No existing year config to clone. Contact the dev.';
    return;
  }
  try {
    await admin.clone(admin.configs[0].taxYear, newYear.value);
    router.push(`/admin/tax-years/${newYear.value}`);
  } catch (e: any) {
    error.value = e?.body?.error === 'already_exists'
      ? `Year ${newYear.value} already exists.`
      : e?.message || 'Failed to create year.';
  }
}

async function doClone() {
  error.value = null;
  if (!cloneSource.value || !cloneTarget.value) return;
  try {
    await admin.clone(cloneSource.value, cloneTarget.value);
    router.push(`/admin/tax-years/${cloneTarget.value}`);
  } catch (e: any) {
    error.value = e?.body?.error === 'already_exists'
      ? `Target year ${cloneTarget.value} already exists.`
      : e?.message || 'Clone failed.';
  }
}

async function deleteYear(year: number) {
  error.value = null;
  if (!confirm(`Delete config for ${year}? This cannot be undone.`)) return;
  try {
    await admin.remove(year);
  } catch (e: any) {
    if (e?.body?.error === 'in_use') {
      error.value = `Cannot delete ${year}: ${e.body.count} return(s) use it.`;
    } else {
      error.value = e?.message || 'Delete failed.';
    }
  }
}

async function toggleAdmin(u: AdminUser) {
  try {
    await api.put(`/api/admin/users/${u.id}/admin`, { isAdmin: !u.isAdmin });
    await refreshUsers();
  } catch (e: any) {
    if (e?.body?.error === 'last_admin') {
      error.value = 'Cannot remove admin from the only admin user.';
    } else {
      error.value = e?.message || 'Update failed.';
    }
  }
}

// Expose internal helpers for unit tests so the early-return guards in
// createBlank / doClone can be exercised (otherwise they're unreachable
// from the DOM — the Create / Clone buttons are :disabled while their
// bound refs are falsy and Vuetify suppresses click on disabled buttons).
defineExpose({ createBlank, doClone, deleteYear, toggleAdmin, newYear, cloneSource, cloneTarget });
</script>

<template>
  <AppShell>
    <h1 class="text-h4 mb-4">Admin</h1>

    <v-alert v-if="error" type="error" class="mb-3" closable @click:close="error = null">
      {{ error }}
    </v-alert>

    <v-card class="mb-6">
      <v-card-title>Tax year configurations</v-card-title>
      <v-card-text>
        <p class="text-medium-emphasis mb-4">
          Each year has its own brackets, standard deduction, credits, and other
          constants. When IRS publishes final figures, edit the year here and
          every user's return for that year is recomputed against the new values.
        </p>

        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Year</th>
              <th>Std deduction (single / MFJ)</th>
              <th>CTC</th>
              <th>Updated</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in admin.configs" :key="c.taxYear">
              <td class="font-weight-bold">{{ c.taxYear }}</td>
              <td>
                ${{ c.standardDeduction.single.toLocaleString() }} /
                ${{ c.standardDeduction.mfj.toLocaleString() }}
              </td>
              <td>${{ c.ctcPerChild.toLocaleString() }}</td>
              <td class="text-caption">{{ (c as any).updatedAt || '' }}</td>
              <td class="text-right">
                <v-btn
                  size="small"
                  variant="text"
                  :to="`/admin/tax-years/${c.taxYear}`"
                >
Edit
</v-btn>
                <v-btn
                  size="small"
                  variant="text"
                  color="error"
                  @click="deleteYear(c.taxYear)"
                >
Delete
</v-btn>
              </td>
            </tr>
            <tr v-if="!admin.configs.length">
              <td colspan="5" class="text-medium-emphasis">No year configs yet.</td>
            </tr>
          </tbody>
        </v-table>

        <v-divider class="my-4" />

        <div class="d-flex gap-4 flex-wrap">
          <v-card variant="tonal" class="pa-3 flex-grow-1">
            <h3 class="text-subtitle-1 mb-2">Clone year</h3>
            <v-row>
              <v-col cols="5">
                <v-select
                  v-model="cloneSource"
                  :items="admin.configs.map((c) => c.taxYear)"
                  label="From"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="5">
                <v-text-field
                  v-model.number="cloneTarget"
                  label="To year"
                  type="number"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="2">
                <v-btn color="primary" block :disabled="!cloneSource || !cloneTarget" @click="doClone">
                  Clone
                </v-btn>
              </v-col>
            </v-row>
          </v-card>

          <v-card variant="tonal" class="pa-3 flex-grow-1">
            <h3 class="text-subtitle-1 mb-2">New year from current template</h3>
            <v-row>
              <v-col cols="8">
                <v-text-field
                  v-model.number="newYear"
                  label="Year"
                  type="number"
                  variant="outlined"
                  density="comfortable"
                />
              </v-col>
              <v-col cols="4">
                <v-btn color="primary" block :disabled="!newYear" @click="createBlank">Create</v-btn>
              </v-col>
            </v-row>
          </v-card>
        </div>
      </v-card-text>
    </v-card>

    <v-card>
      <v-card-title>Users</v-card-title>
      <v-card-text>
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Verified</th>
              <th>Admin</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.username }}</td>
              <td>{{ u.email }}</td>
              <td>
                <v-icon v-if="u.emailVerified" color="primary">mdi-check-circle</v-icon>
                <v-icon v-else color="grey">mdi-circle-outline</v-icon>
              </td>
              <td>
                <v-switch
                  :model-value="u.isAdmin"
                  color="primary"
                  density="compact"
                  hide-details
                  @update:model-value="toggleAdmin(u)"
                />
              </td>
              <td class="text-caption">{{ u.createdAt }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </AppShell>
</template>
