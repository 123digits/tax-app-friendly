import { describe, it, expect } from 'vitest';
import { mountWith } from '../../test-setup/vue-helpers';
import SsnInput from './SsnInput.vue';

describe('SsnInput', () => {
  it('formats 9 digits as XXX-XX-XXXX', async () => {
    const { wrapper } = mountWith(SsnInput, { props: { modelValue: '' } });
    const input = wrapper.find('input');
    await input.setValue('123456789');
    const events = wrapper.emitted('update:modelValue');
    expect(events!.at(-1)).toEqual(['123-45-6789']);
  });

  it('formats partial digits 4 as XXX-X', async () => {
    const { wrapper } = mountWith(SsnInput, { props: { modelValue: '' } });
    const input = wrapper.find('input');
    await input.setValue('1234');
    const events = wrapper.emitted('update:modelValue');
    expect(events!.at(-1)).toEqual(['123-4']);
  });

  it('leaves 3 digits unformatted', async () => {
    const { wrapper } = mountWith(SsnInput, { props: { modelValue: '' } });
    const input = wrapper.find('input');
    await input.setValue('123');
    const events = wrapper.emitted('update:modelValue');
    expect(events!.at(-1)).toEqual(['123']);
  });

  it('strips non-digits', async () => {
    const { wrapper } = mountWith(SsnInput, { props: { modelValue: '' } });
    const input = wrapper.find('input');
    await input.setValue('abc12-34de5678f9');
    const events = wrapper.emitted('update:modelValue');
    expect(events!.at(-1)).toEqual(['123-45-6789']);
  });

  it('renders last4 hint when provided', () => {
    const { wrapper } = mountWith(SsnInput, { props: { modelValue: '', last4: '6789' } });
    expect(wrapper.html()).toContain('6789');
  });

  it('uses fallback hint when no last4', () => {
    const { wrapper } = mountWith(SsnInput, { props: { modelValue: '', hint: 'Custom hint' } });
    expect(wrapper.html()).toContain('Custom hint');
  });

  it('uses default hint when no hint or last4', () => {
    const { wrapper } = mountWith(SsnInput, { props: { modelValue: '' } });
    expect(wrapper.html()).toContain('Format:');
  });

  it('renders empty value when modelValue is null', () => {
    const { wrapper } = mountWith(SsnInput, { props: { modelValue: null } });
    const input = wrapper.find('input');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  it('honors custom label', () => {
    const { wrapper } = mountWith(SsnInput, { props: { modelValue: '', label: 'Custom Label' } });
    expect(wrapper.html()).toContain('Custom Label');
  });
});
