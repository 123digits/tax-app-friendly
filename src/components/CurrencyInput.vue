<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: number | null | undefined;
  label?: string;
  hint?: string;
  disabled?: boolean;
  density?: 'default' | 'comfortable' | 'compact';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: number): void;
}>();

const value = computed({
  get: () => (props.modelValue == null ? '' : String(props.modelValue)),
  set: (v: string) => {
    const num = Number(String(v).replace(/[^0-9.-]/g, ''));
    emit('update:modelValue', Number.isFinite(num) ? num : 0);
  },
});
</script>

<template>
  <v-text-field
    v-model="value"
    :label="label"
    :hint="hint"
    :disabled="disabled"
    :density="density || 'comfortable'"
    prefix="$"
    inputmode="decimal"
    variant="outlined"
    type="text"
  />
</template>
