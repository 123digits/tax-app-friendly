<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  step: number;
  totalSteps: number;
  canBack?: boolean;
  canNext?: boolean;
  nextLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'next'): void;
}>();

const progress = computed(() => Math.round((props.step / props.totalSteps) * 100));
</script>

<template>
  <v-card class="mx-auto" max-width="800">
    <v-card-title class="d-flex align-center">
      <span>{{ title }}</span>
      <v-spacer />
      <span class="text-caption text-medium-emphasis">
        Step {{ step }} of {{ totalSteps }}
      </span>
    </v-card-title>
    <v-progress-linear :model-value="progress" color="primary" height="4" />
    <v-card-text>
      <slot />
    </v-card-text>
    <v-divider />
    <v-card-actions>
      <v-btn :disabled="canBack === false" variant="text" @click="emit('back')">
        <v-icon start>mdi-chevron-left</v-icon>
        Back
      </v-btn>
      <v-spacer />
      <v-btn
        color="primary"
        :disabled="canNext === false"
        @click="emit('next')"
      >
        {{ nextLabel || 'Next' }}
        <v-icon end>mdi-chevron-right</v-icon>
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
