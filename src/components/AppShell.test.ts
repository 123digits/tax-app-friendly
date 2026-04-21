import { describe, it, expect } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../test-setup/vue-helpers';
import AppShell from './AppShell.vue';
import { useAuthStore } from '../stores/auth';
import { useTaxReturnStore } from '../stores/taxReturn';

describe('AppShell', () => {
  it('renders default slot content', () => {
    const { wrapper } = mountInApp(AppShell, { slots: { default: '<div class="child">x</div>' } });
    const auth = useAuthStore();
    auth.user = {
      id: 'u', username: 'alice', email: 'a@b', emailVerified: true, isAdmin: false,
      createdAt: new Date().toISOString(),
    };
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.find('.child').exists()).toBe(true);
    });
  });

  it('shows admin link when user is admin', async () => {
    const { wrapper } = mountInApp(AppShell);
    const auth = useAuthStore();
    auth.user = {
      id: 'u', username: 'admin', email: 'admin@example.com',
      emailVerified: true, isAdmin: true, createdAt: new Date().toISOString(),
    };
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toContain('Admin');
  });

  it('renders refund chip when computed is present', async () => {
    const { wrapper } = mountInApp(AppShell);
    const tax = useTaxReturnStore();
    tax.data = stubTaxStoreData() as never;
    tax.computed = {
      summary: { refund: 100, balanceDue: 0 },
    } as never;
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatch(/Refund/);
  });

  it('shows balance due when no refund', async () => {
    const { wrapper } = mountInApp(AppShell);
    const tax = useTaxReturnStore();
    tax.computed = { summary: { refund: 0, balanceDue: 250 } } as never;
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toMatch(/Owe/);
  });

  it('shows zero when neither refund nor balance due', async () => {
    const { wrapper } = mountInApp(AppShell);
    const tax = useTaxReturnStore();
    tax.computed = { summary: { refund: 0, balanceDue: 0 } } as never;
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toContain('$0');
  });

  it('handles logout', async () => {
    const { wrapper, router } = mountInApp(AppShell);
    const auth = useAuthStore();
    auth.user = {
      id: 'u', username: 'alice', email: 'a@b', emailVerified: true, isAdmin: false,
      createdAt: new Date().toISOString(),
    };
    auth.logout = async () => { auth.user = null; };
    await wrapper.vm.$nextTick();
    const logoutBtn = wrapper.findAll('button').find((b) => b.text().includes('Log out'));
    expect(logoutBtn).toBeTruthy();
    await logoutBtn!.trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    expect(router.currentRoute.value.name).toBe('login');
  });
});
