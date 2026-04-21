<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { SectionConfig } from '../config/sections';
import type { TaxReturn } from '../../shared/types';

const props = defineProps<{
  section: SectionConfig;
  ret: TaxReturn;
}>();

const router = useRouter();

const done = computed(() => props.section.progress(props.ret));
const percent = computed(() => Math.round((done.value / props.section.stepCount) * 100));
const complete = computed(() => done.value >= props.section.stepCount);
</script>

<template>
  <v-card
    hover
    class="h-100"
    @click="router.push(section.route)"
  >
    <v-card-item>
      <template #prepend>
        <v-avatar :color="complete ? 'primary' : 'grey-lighten-2'">
          <v-icon :color="complete ? 'white' : 'grey-darken-2'">
            {{ section.icon }}
          </v-icon>
        </v-avatar>
      </template>
      <v-card-title>{{ section.title }}</v-card-title>
      <v-card-subtitle>{{ section.subtitle }}</v-card-subtitle>
    </v-card-item>
    <v-card-text>
      <v-progress-linear :model-value="percent" color="primary" height="6" rounded />
      <div class="d-flex align-center mt-2">
        <v-chip size="small" :color="complete ? 'primary' : undefined" variant="tonal">
          {{ done }} of {{ section.stepCount }} steps
        </v-chip>
        <v-spacer />
        <v-icon v-if="complete" color="primary">mdi-check-circle</v-icon>
      </div>
    </v-card-text>
  </v-card>
</template>
