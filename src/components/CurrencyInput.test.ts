import { describe, it, expect } from 'vitest';
import { mountWith } from '../../test-setup/vue-helpers';
import CurrencyInput from './CurrencyInput.vue';

describe('CurrencyInput', () => {
  it('renders with a label and prefix', () => {
    const { wrapper } = mountWith(CurrencyInput, { props: { modelValue: 100, label: 'Amount' } });
    expect(wrapper.html()).toContain('Amount');
    expect(wrapper.html()).toContain('$');
  });

  it('emits updated numeric value on input change', async () => {
    const { wrapper } = mountWith(CurrencyInput, { props: { modelValue: 0, label: 'Amt' } });
    const input = wrapper.find('input');
    expect(input.exists()).toBe(true);
    await input.setValue('1,234');
    const events = wrapper.emitted('update:modelValue');
    expect(events).toBeTruthy();
    expect(events!.at(-1)).toEqual([1234]);
  });

  it('coerces non-numeric input to 0', async () => {
    const { wrapper } = mountWith(CurrencyInput, { props: { modelValue: 0, label: 'Amt' } });
    const input = wrapper.find('input');
    await input.setValue('abc');
    const events = wrapper.emitted('update:modelValue');
    expect(events!.at(-1)).toEqual([0]);
  });

  it('renders empty string when modelValue is null', () => {
    const { wrapper } = mountWith(CurrencyInput, { props: { modelValue: null, label: 'Amt' } });
    const input = wrapper.find('input');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('accepts density override', () => {
    const { wrapper } = mountWith(CurrencyInput, {
      props: { modelValue: 100, label: 'Amt', density: 'compact' },
    });
    expect(wrapper.html()).toContain('Amt');
  });

  it('handles undefined modelValue', () => {
    const { wrapper } = mountWith(CurrencyInput, {
      props: { modelValue: undefined as unknown as number, label: 'Amt' },
    });
    const input = wrapper.find('input');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('handles NaN gracefully', async () => {
    const { wrapper } = mountWith(CurrencyInput, { props: { modelValue: 0, label: 'Amt' } });
    const input = wrapper.find('input');
    await input.setValue('--1.-.2');
    // Whatever happens, it should emit a finite number or 0.
    const events = wrapper.emitted('update:modelValue');
    const last = events!.at(-1)![0] as number;
    expect(Number.isFinite(last)).toBe(true);
  });
});
