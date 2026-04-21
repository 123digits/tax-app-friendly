<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: string | null | undefined;
  label?: string;
  last4?: string | null;
  hint?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
}>();

const value = computed({
  get: () => props.modelValue ?? '',
  set: (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 9);
    let formatted = digits;
    if (digits.length > 5) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    emit('update:modelValue', formatted);
  },
});

const placeholderHint = computed(() => {
  if (props.last4) return `On file: •••-••-${props.last4} (leave blank to keep)`;
  return props.hint || 'Format: 123-45-6789';
});
</script>

<template>
  <v-text-field
    v-model="value"
    :label="label || 'Social Security Number'"
    :hint="placeholderHint"
    persistent-hint
    variant="outlined"
    density="comfortable"
    inputmode="numeric"
    maxlength="11"
  />
</template>
