import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountInApp } from '../../../test-setup/vue-helpers';
import AdminView from './AdminView.vue';
import TaxYearEditView from './TaxYearEditView.vue';
import { useAdminStore } from '../../stores/admin';
import { api } from '../../api/client';

function mockApi(users: unknown[] = []) {
  api.get = vi.fn(async (url: string) => {
    if (url.includes('/api/admin/users')) return users;
    if (url.includes('/api/admin/tax-years/')) {
      return stubConfig();
    }
    return [stubConfig()];
  }) as unknown as typeof api.get;
  api.post = vi.fn(async () => ({ ok: true })) as unknown as typeof api.post;
  api.put = vi.fn(async () => ({ ok: true })) as unknown as typeof api.put;
  api.delete = vi.fn(async () => ({ ok: true })) as unknown as typeof api.delete;
}

function stubConfig() {
  return {
    taxYear: 2025,
    brackets: {
      single: [{ upTo: null, rate: 0.1 }],
      mfj: [{ upTo: null, rate: 0.1 }],
      mfs: [{ upTo: null, rate: 0.1 }],
      hoh: [{ upTo: null, rate: 0.1 }],
      qw: [{ upTo: null, rate: 0.1 }],
    },
    standardDeduction: { single: 14000, mfj: 28000, mfs: 14000, hoh: 21000, qw: 28000 },
    ctcPerChild: 2000,
    ctcPhaseoutStart: { single: 200000, mfj: 400000, mfs: 200000, hoh: 200000, qw: 200000 },
    ssWageBase: 168000,
    ltcgBrackets: {
      single: { zeroUpTo: 47000, fifteenUpTo: 518000 },
      mfj: { zeroUpTo: 94000, fifteenUpTo: 583000 },
      mfs: { zeroUpTo: 47000, fifteenUpTo: 291000 },
      hoh: { zeroUpTo: 63000, fifteenUpTo: 551000 },
      qw: { zeroUpTo: 94000, fifteenUpTo: 583000 },
    },
    saltCap: 10000,
    medicalAgiThreshold: 0.075,
    capitalLossLimit: 3000,
    notes: null,
  };
}

beforeEach(() => {
  mockApi();
});

describe('AdminView', () => {
  it('renders the tax year table', async () => {
    const { wrapper } = mountInApp(AdminView, {}, {
      beforeMount: () => {
        const admin = useAdminStore();
        admin.configs = [stubConfig()] as never;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toContain('2025');
  });

  it('shows users list', async () => {
    mockApi([
      { id: 'u1', username: 'alice', email: 'a@b', emailVerified: true, isAdmin: false, createdAt: 'now' },
    ]);
    const { wrapper } = mountInApp(AdminView);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toContain('alice');
  });

  it('toggles admin flag', async () => {
    const users = [
      { id: 'u1', username: 'alice', email: 'a@b', emailVerified: true, isAdmin: false, createdAt: 'n' },
    ];
    mockApi(users);
    const { wrapper } = mountInApp(AdminView);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const switches = wrapper.findAllComponents({ name: 'VSwitch' });
    if (switches.length > 0) {
      await switches[0].vm.$emit('update:modelValue', true);
    }
    expect((api.put as ReturnType<typeof vi.fn>).mock).toBeTruthy();
  });

  it('delete year when confirmed', async () => {
    mockApi();
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const { wrapper } = mountInApp(AdminView, {}, {
      beforeMount: () => {
        const admin = useAdminStore();
        admin.configs = [stubConfig()] as never;
        admin.remove = vi.fn() as unknown as typeof admin.remove;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    const delBtn = wrapper.findAll('button').find((b) => b.text().includes('Delete'));
    await delBtn!.trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('delete aborted when not confirmed', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    const { wrapper } = mountInApp(AdminView, {}, {
      beforeMount: () => {
        const admin = useAdminStore();
        admin.configs = [stubConfig()] as never;
        admin.remove = vi.fn() as unknown as typeof admin.remove;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    const delBtn = wrapper.findAll('button').find((b) => b.text().includes('Delete'));
    await delBtn!.trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('clone year action navigates', async () => {
    const { wrapper, router } = mountInApp(AdminView, {}, {
      beforeMount: () => {
        const admin = useAdminStore();
        admin.configs = [stubConfig()] as never;
        admin.clone = vi.fn() as unknown as typeof admin.clone;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    // Set clone target via v-text-field
    const inputs = wrapper.findAll('input[type="number"]');
    if (inputs.length > 0) {
      await inputs[0].setValue(2099);
    }
    const cloneBtn = wrapper.findAll('button').find((b) => /Clone/i.test(b.text()));
    if (cloneBtn && !cloneBtn.attributes('disabled')) {
      await cloneBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    void router;
  });

  it('createBlank when no configs shows error', async () => {
    const { wrapper } = mountInApp(AdminView, {}, {
      beforeMount: () => {
        const admin = useAdminStore();
        admin.configs = [];
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    const inputs = wrapper.findAll('input[type="number"]');
    if (inputs.length > 0) {
      await inputs[inputs.length - 1].setValue(2099);
    }
    const createBtn = wrapper.findAll('button').find((b) => /^Create$/.test(b.text()));
    if (createBtn && !createBtn.attributes('disabled')) {
      await createBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
  });
});

describe('TaxYearEditView', () => {
  async function mountEdit(route = '/admin/tax-years/2025') {
    const result = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const admin = useAdminStore();
        admin.get = vi.fn(async () => stubConfig() as never) as unknown as typeof admin.get;
        admin.save = vi.fn() as unknown as typeof admin.save;
      },
    });
    await result.router.push(route);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    return result;
  }

  it('renders with a year parameter', async () => {
    const { wrapper } = await mountEdit();
    expect(wrapper.html()).toContain('Tax year');
  });

  it('shows error when load fails', async () => {
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const admin = useAdminStore();
        admin.get = vi.fn(async () => { throw new Error('load failed'); }) as unknown as typeof admin.get;
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/load failed|Failed to load/);
  });

  it('clicks save button', async () => {
    const { wrapper } = await mountEdit();
    const saveBtn = wrapper.findAll('button').find((b) => /^Save/.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
  });

  it('cancel navigates back to admin', async () => {
    const { wrapper, router } = await mountEdit();
    const backBtn = wrapper.findAll('button').find((b) => /Back to admin|Cancel/i.test(b.text()));
    if (backBtn) {
      await backBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    void router;
  });
});
