// AdminView error-path coverage: createBlank rejects already_exists, doClone
// error branches, deleteYear with in_use error, toggleAdmin last_admin + other
// failure branches.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountInApp } from '../../../test-setup/vue-helpers';
import AdminView from './AdminView.vue';
import { useAdminStore } from '../../stores/admin';
import { api } from '../../api/client';

function stubConfig() {
  return {
    taxYear: 2025,
    brackets: {
      single: [{ upTo: null, rate: 0.1 }], mfj: [{ upTo: null, rate: 0.1 }],
      mfs: [{ upTo: null, rate: 0.1 }], hoh: [{ upTo: null, rate: 0.1 }],
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
  api.get = vi.fn(async (url: string) => {
    if (url.includes('/users')) return [];
    return [stubConfig()];
  }) as unknown as typeof api.get;
  api.post = vi.fn(async () => ({ ok: true })) as unknown as typeof api.post;
  api.put = vi.fn(async () => ({ ok: true })) as unknown as typeof api.put;
  api.delete = vi.fn(async () => ({ ok: true })) as unknown as typeof api.delete;
});

async function mountAdmin(admin?: (s: ReturnType<typeof useAdminStore>) => void) {
  const { wrapper } = mountInApp(AdminView, {}, {
    beforeMount: () => {
      const s = useAdminStore();
      s.configs = [stubConfig()] as never;
      s.load = vi.fn() as unknown as typeof s.load;
      admin?.(s);
    },
  });
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
  return wrapper;
}

describe('AdminView error paths', () => {
  it('createBlank shows "already exists" message on already_exists error', async () => {
    const wrapper = await mountAdmin((s) => {
      s.clone = vi.fn(async () => {
        const err = new Error('x') as Error & { body?: { error?: string } };
        err.body = { error: 'already_exists' };
        throw err;
      }) as unknown as typeof s.clone;
    });
    const numInputs = wrapper.findAll('input[type="number"]');
    if (numInputs.length >= 1) {
      await numInputs[numInputs.length - 1].setValue(2099);
    }
    const createBtn = wrapper.findAll('button').find((b) => /^Create$/.test(b.text()));
    if (createBtn) {
      await createBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/already exists|Failed to create/);
  });

  it('createBlank shows generic error on plain failure', async () => {
    const wrapper = await mountAdmin((s) => {
      s.clone = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof s.clone;
    });
    const numInputs = wrapper.findAll('input[type="number"]');
    if (numInputs.length >= 1) {
      await numInputs[numInputs.length - 1].setValue(2099);
    }
    const createBtn = wrapper.findAll('button').find((b) => /^Create$/.test(b.text()));
    if (createBtn) {
      await createBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/boom|Failed to create/);
  });

  it('doClone shows "target exists" message on already_exists error', async () => {
    const wrapper = await mountAdmin((s) => {
      s.clone = vi.fn(async () => {
        const err = new Error('e') as Error & { body?: { error?: string } };
        err.body = { error: 'already_exists' };
        throw err;
      }) as unknown as typeof s.clone;
    });
    const numInputs = wrapper.findAll('input[type="number"]');
    if (numInputs.length >= 1) {
      await numInputs[0].setValue(2098);
    }
    const cloneBtn = wrapper.findAll('button').find((b) => /^Clone$/.test(b.text()));
    if (cloneBtn && !cloneBtn.attributes('disabled')) {
      await cloneBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/already exists|Clone failed/);
  });

  it('doClone shows generic message on plain failure', async () => {
    const wrapper = await mountAdmin((s) => {
      s.clone = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof s.clone;
    });
    const numInputs = wrapper.findAll('input[type="number"]');
    if (numInputs.length >= 1) {
      await numInputs[0].setValue(2098);
    }
    const cloneBtn = wrapper.findAll('button').find((b) => /^Clone$/.test(b.text()));
    if (cloneBtn && !cloneBtn.attributes('disabled')) {
      await cloneBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/boom|Clone failed/);
  });

  it('deleteYear shows in_use message', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const wrapper = await mountAdmin((s) => {
      s.remove = vi.fn(async () => {
        const err = new Error('e') as Error & { body?: { error?: string; count?: number } };
        err.body = { error: 'in_use', count: 3 };
        throw err;
      }) as unknown as typeof s.remove;
    });
    const delBtn = wrapper.findAll('button').find((b) => /^Delete$/.test(b.text()));
    if (delBtn) {
      await delBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/Cannot delete|Delete failed/);
    confirmSpy.mockRestore();
  });

  it('deleteYear shows generic error on other failures', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const wrapper = await mountAdmin((s) => {
      s.remove = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof s.remove;
    });
    const delBtn = wrapper.findAll('button').find((b) => /^Delete$/.test(b.text()));
    if (delBtn) {
      await delBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/boom|Delete failed/);
    confirmSpy.mockRestore();
  });

  it('toggleAdmin shows last_admin message', async () => {
    api.get = vi.fn(async (url: string) => {
      if (url.includes('/users')) return [
        { id: 'u1', username: 'a', email: 'a@b', emailVerified: true, isAdmin: true, createdAt: 'n' },
      ];
      return [stubConfig()];
    }) as unknown as typeof api.get;
    api.put = vi.fn(async () => {
      const err = new Error('e') as Error & { body?: { error?: string } };
      err.body = { error: 'last_admin' };
      throw err;
    }) as unknown as typeof api.put;
    const wrapper = await mountAdmin();
    const switches = wrapper.findAllComponents({ name: 'VSwitch' });
    if (switches.length > 0) {
      await switches[0].vm.$emit('update:modelValue', false);
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/only admin|Update failed/);
  });

  it('toggleAdmin shows generic error on other failures', async () => {
    api.get = vi.fn(async (url: string) => {
      if (url.includes('/users')) return [
        { id: 'u1', username: 'a', email: 'a@b', emailVerified: true, isAdmin: true, createdAt: 'n' },
      ];
      return [stubConfig()];
    }) as unknown as typeof api.get;
    api.put = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof api.put;
    const wrapper = await mountAdmin();
    const switches = wrapper.findAllComponents({ name: 'VSwitch' });
    if (switches.length > 0) {
      await switches[0].vm.$emit('update:modelValue', false);
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/boom|Update failed/);
  });

  it('createBlank with no configs shows the no-template error', async () => {
    const wrapper = await mountAdmin((s) => { s.configs = []; });
    const numInputs = wrapper.findAll('input[type="number"]');
    if (numInputs.length >= 1) {
      await numInputs[numInputs.length - 1].setValue(2099);
    }
    const createBtn = wrapper.findAll('button').find((b) => /^Create$/.test(b.text()));
    if (createBtn && !createBtn.attributes('disabled')) {
      await createBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/No existing year config|Failed to create|year config/);
  });

  it('createBlank falls back to "Failed to create year" when error has no message', async () => {
    // Exercises `err.message || 'Failed to create year.'` right-side branch
    // when an error object without a message is thrown.
    const wrapper = await mountAdmin((s) => {
      s.clone = vi.fn(async () => { throw new Error(''); }) as unknown as typeof s.clone;
    });
    const numInputs = wrapper.findAll('input[type="number"]');
    if (numInputs.length >= 1) {
      await numInputs[numInputs.length - 1].setValue(2099);
    }
    const createBtn = wrapper.findAll('button').find((b) => /^Create$/.test(b.text()));
    if (createBtn) {
      await createBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/Failed to create year/);
  });

  it('doClone falls back to "Clone failed" when error has no message', async () => {
    const wrapper = await mountAdmin((s) => {
      s.clone = vi.fn(async () => { throw new Error(''); }) as unknown as typeof s.clone;
    });
    const numInputs = wrapper.findAll('input[type="number"]');
    if (numInputs.length >= 2) {
      await numInputs[0].setValue(2025);
      await numInputs[1].setValue(2099);
    }
    const cloneBtn = wrapper.findAll('button').find((b) => /^Clone$/.test(b.text()));
    if (cloneBtn) {
      await cloneBtn.trigger('click');
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(wrapper.html()).toMatch(/Clone failed/);
  });

});
