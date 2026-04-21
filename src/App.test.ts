import { describe, it, expect } from 'vitest';
import { mountWith } from '../test-setup/vue-helpers';
import App from './App.vue';

describe('App', () => {
  it('mounts', () => {
    const { wrapper } = mountWith(App);
    expect(wrapper.html()).toBeTruthy();
  });
});
