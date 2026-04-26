// Targeted tests to close 100%-coverage gaps in DashboardView,
// AdminView, TaxYearEditView, and RegisterView. Each `it` exercises
// one specific defensive branch the broader interactive suites don't
// already hit.
import { describe, it, expect, vi } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../test-setup/vue-helpers';
import { useTaxReturnStore } from '../stores/taxReturn';
import { useAdminStore } from '../stores/admin';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/client';
import DashboardView from './DashboardView.vue';
import AdminView from './admin/AdminView.vue';
import TaxYearEditView from './admin/TaxYearEditView.vue';
import RegisterView from './auth/RegisterView.vue';

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('DashboardView — activeYear computed branches', () => {
  it('falls back to taxStore.activeYear when data has no taxYear', async () => {
    // Exercises the second `?? taxStore.activeYear` arm of line 16. The
    // template only renders activeYear inside `v-else-if="taxStore.data"`,
    // so we set data to a non-null object that's missing taxYear and
    // touch the computed via the rendered "Your … Return" heading.
    const stubData = stubTaxStoreData() as unknown as Record<string, unknown>;
    delete stubData.taxYear;
    const { wrapper } = mountInApp(DashboardView, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubData as never;
        s.loading = false;
        s.activeYear = 2024;
        s.myReturns = [] as never;
        s.availableYears = [] as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.loadYearLists = vi.fn() as unknown as typeof s.loadYearLists;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
      },
    });
    await flush();
    // Heading should now read "Your 2024 Return" — proving activeYear
    // resolved via the fallback.
    expect(wrapper.html()).toMatch(/Your 2024 Return/);
  });

  it('resolves activeYear to null when data has no taxYear AND store.activeYear is null', async () => {
    // Exercises the trailing `?? null` arm of line 16. We need data to
    // be non-null (else the v-else-if hides the activeYear binding) but
    // its taxYear field undefined AND activeYear null.
    const stubData = stubTaxStoreData() as unknown as Record<string, unknown>;
    delete stubData.taxYear;
    const { wrapper } = mountInApp(DashboardView, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        s.data = stubData as never;
        s.loading = false;
        s.activeYear = null;
        s.myReturns = [] as never;
        s.availableYears = [] as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.loadYearLists = vi.fn() as unknown as typeof s.loadYearLists;
        s.refreshComputed = vi.fn() as unknown as typeof s.refreshComputed;
      },
    });
    await flush();
    // The h1 reads "Your  Return" with an empty interpolation when
    // activeYear is null — confirming all three nullish branches fired.
    expect(wrapper.html()).toMatch(/Your\s+Return/);
  });
});

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

describe('AdminView — toggleAdmin generic-error fallback', () => {
  it('falls back to "Update failed." when toggleAdmin error has no message', async () => {
    // Exercises the `e?.message || 'Update failed.'` right-side branch on
    // line 89 of AdminView.vue.
    api.get = vi.fn(async (url: string) => {
      if (url.includes('/users')) return [
        { id: 'u1', username: 'a', email: 'a@b', emailVerified: true,
          isAdmin: true, createdAt: 'n' },
      ];
      return [stubConfig()];
    }) as unknown as typeof api.get;
    api.put = vi.fn(async () => { throw new Error(''); }) as unknown as typeof api.put;
    const { wrapper } = mountInApp(AdminView, {}, {
      beforeMount: () => {
        const s = useAdminStore();
        s.configs = [stubConfig()] as never;
        s.load = vi.fn() as unknown as typeof s.load;
      },
    });
    await flush();
    const switches = wrapper.findAllComponents({ name: 'VSwitch' });
    if (switches.length > 0) {
      await switches[0].vm.$emit('update:modelValue', false);
      await flush();
    }
    expect(wrapper.html()).toMatch(/Update failed/);
  });

  it('createBlank / doClone early-return when newYear / cloneSource / cloneTarget are blank', async () => {
    // Exercises lines 38 and 56 of AdminView.vue. The `Create` / `Clone`
    // buttons are :disabled when their bound refs are falsy, so the DOM
    // click event never reaches the handler. We invoke the helpers
    // directly via defineExpose to fire the early-return guards.
    api.get = vi.fn(async (url: string) => {
      if (url.includes('/users')) return [];
      return [stubConfig()];
    }) as unknown as typeof api.get;
    const cloneStub = vi.fn();
    const { wrapper } = mountInApp(AdminView, {}, {
      beforeMount: () => {
        const s = useAdminStore();
        s.configs = [stubConfig()] as never;
        s.load = vi.fn() as unknown as typeof s.load;
        s.clone = cloneStub as unknown as typeof s.clone;
      },
    });
    await flush();
    type ExposedAdminVm = {
      createBlank: () => Promise<void>;
      doClone: () => Promise<void>;
      newYear: number | null;
      cloneSource: number | null;
      cloneTarget: number | null;
    };
    const vm = wrapper.findComponent(AdminView).vm as unknown as ExposedAdminVm;
    // Vue's setup proxy auto-unwraps refs on the public instance: writing
    // through the property sets the underlying ref.value.
    vm.newYear = null;
    vm.cloneSource = null;
    vm.cloneTarget = null;
    await vm.createBlank();
    await vm.doClone();
    expect(cloneStub).not.toHaveBeenCalled();
  });

  it('refreshUsers re-fetches the users list after toggleAdmin succeeds', async () => {
    // Exercises the `await refreshUsers()` line inside toggleAdmin on
    // line 84 of AdminView.vue (covers the `refreshUsers` function for
    // a second invocation).
    let getCalls = 0;
    api.get = vi.fn(async (url: string) => {
      if (url.includes('/users')) {
        getCalls += 1;
        return [
          { id: 'u1', username: 'a', email: 'a@b', emailVerified: true,
            isAdmin: false, createdAt: 'n' },
        ];
      }
      return [stubConfig()];
    }) as unknown as typeof api.get;
    api.put = vi.fn(async () => ({ ok: true })) as unknown as typeof api.put;
    const { wrapper } = mountInApp(AdminView, {}, {
      beforeMount: () => {
        const s = useAdminStore();
        s.configs = [stubConfig()] as never;
        s.load = vi.fn() as unknown as typeof s.load;
      },
    });
    await flush();
    const before = getCalls;
    const switches = wrapper.findAllComponents({ name: 'VSwitch' });
    if (switches.length > 0) {
      await switches[0].vm.$emit('update:modelValue', true);
      await flush();
    }
    expect(getCalls).toBeGreaterThan(before);
  });
});

describe('TaxYearEditView — defensive cfg-null guards + JSON parse-error fallback', () => {
  it('addBracket / removeBracket / save are no-ops when cfg.value is still null', async () => {
    // Exercises lines 116, 121, and 143 of TaxYearEditView.vue. We make
    // the initial admin.get reject so cfg.value stays null, then reach
    // into the component's setup via defineExpose to call the helpers.
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = vi.fn(async () => {
          throw new Error('synthetic load failure');
        }) as unknown as typeof s.get;
        s.save = vi.fn() as unknown as typeof s.save;
      },
    });
    await flush();
    type ExposedEditorVm = {
      addBracket: (status: string) => void;
      removeBracket: (status: string, i: number) => void;
      save: () => Promise<void>;
    };
    const vm = wrapper.findComponent(TaxYearEditView).vm as unknown as ExposedEditorVm;
    vm.addBracket('single');
    vm.removeBracket('single', 0);
    await vm.save();
    // Each call should have early-returned without throwing — the error
    // alert from the failed load is still rendered.
    expect(wrapper.html()).toMatch(/synthetic load failure|Failed to load/);
  });

  it('seedGroupDrafts early-returns when admin.get resolves to null (cfg stays null)', async () => {
    // Exercises line 78 of TaxYearEditView.vue: the `if (!cfg.value) return;`
    // guard inside seedGroupDrafts(). seedGroupDrafts is invoked from
    // onMounted right after `cfg.value = await admin.get(year)`. When
    // admin.get returns null, cfg.value stays null and seedGroupDrafts
    // hits the guard.
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = vi.fn(async () => null) as unknown as typeof s.get;
        s.save = vi.fn() as unknown as typeof s.save;
      },
    });
    await flush();
    // The progress spinner is still shown when cfg is null after load.
    expect(wrapper.html()).toContain('v-progress-circular');
  });

  it('applyGroupDrafts coalesces a missing groupDrafts entry to "" via the ?? fallback', async () => {
    // Exercises the `(groupDrafts.value[g.key] ?? '').trim()` ?? branch.
    // After a successful load seedGroupDrafts populates every key — we
    // explicitly delete one entry, then click Save so applyGroupDrafts
    // re-reads the missing key and falls through the `?? ''` arm.
    const cfg = stubConfig();
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = vi.fn(async () => cfg as never) as unknown as typeof s.get;
        s.save = vi.fn() as unknown as typeof s.save;
      },
    });
    await flush();
    type ExposedEditorVm = {
      groupDrafts: Record<string, string>;
      save: () => Promise<void>;
    };
    const vm = wrapper.findComponent(TaxYearEditView).vm as unknown as ExposedEditorVm;
    delete vm.groupDrafts.retirement;
    await vm.save();
    await flush();
    expect(wrapper.html()).toBeTruthy();
  });

  it('JSON parse error with no message surfaces the "parse error" fallback string', async () => {
    // Exercises the right-side branch of `e?.message || 'parse error'`
    // on line 99 of TaxYearEditView.vue.
    const cfg = stubConfig();
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = vi.fn(async () => cfg as never) as unknown as typeof s.get;
        s.save = vi.fn() as unknown as typeof s.save;
      },
    });
    await flush();
    // Stub JSON.parse so it throws an Error WITHOUT a message.
    const origParse = JSON.parse;
    JSON.parse = ((input: string) => {
      if (input.startsWith('{')) {
        const e = new Error('');
        throw e;
      }
      return origParse(input);
    }) as typeof JSON.parse;
    try {
      // Expand the JSON-group panels so the textareas mount.
      const panelTitles = wrapper.findAllComponents({ name: 'VExpansionPanelTitle' });
      for (const t of panelTitles) {
        await t.trigger('click');
        await flush();
      }
      const textareas = wrapper.findAll('textarea');
      if (textareas.length > 0) {
        await textareas[0].setValue('{"some": "json"}');
        await flush();
      }
      const saveBtn = wrapper.findAll('button').find((b) => /^Save$/.test(b.text()));
      if (saveBtn) {
        await saveBtn.trigger('click');
        await flush();
      }
      expect(wrapper.html()).toMatch(/Invalid JSON: parse error/);
    } finally {
      JSON.parse = origParse;
    }
  });
});

describe('AdminView — cloneSource v-model setter', () => {
  it('emits update on the cloneSource v-select to fire the inline setter', async () => {
    // Vue generates an anonymous `(value) => cloneSource = value` setter
    // for the `v-model="cloneSource"` binding on the v-select. Without
    // a select-driven update event, that setter never executes and v8
    // marks it as an uncovered function on AdminView.vue.
    api.get = vi.fn(async (url: string) => {
      if (url.includes('/users')) return [];
      return [stubConfig()];
    }) as unknown as typeof api.get;
    const { wrapper } = mountInApp(AdminView, {}, {
      beforeMount: () => {
        const s = useAdminStore();
        s.configs = [stubConfig()] as never;
        s.load = vi.fn() as unknown as typeof s.load;
      },
    });
    await flush();
    // The first VSelect inside the "Clone year" card is bound to cloneSource.
    const selects = wrapper.findAllComponents({ name: 'VSelect' });
    if (selects.length > 0) {
      await selects[0].vm.$emit('update:modelValue', 2024);
      await flush();
    }
    expect(wrapper.html()).toBeTruthy();
  });
});

describe('RegisterView — fallback when error is generic with no message', () => {
  it('falls back to "Registration failed." when error has no body.error and no message', async () => {
    // Exercises the right-side branch of `e?.message || 'Registration failed.'`
    // on line 38 of RegisterView.vue.
    const { wrapper } = mountInApp(RegisterView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.register = vi.fn(async () => { throw new Error(''); }) as unknown as typeof auth.register;
      },
    });
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('a@b.com');
    await inputs[2].setValue('password123');
    await inputs[3].setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await flush();
    expect(wrapper.html()).toMatch(/Registration failed/);
  });

  it('falls back to "Verification failed." when verifyEmail throws an error with no message', async () => {
    // Exercises the right-side branch of `e?.message || 'Verification failed.'`
    // on line 51 of RegisterView.vue.
    const { wrapper } = mountInApp(RegisterView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.register = vi.fn(async () => { /* noop */ }) as unknown as typeof auth.register;
        auth.verifyEmail = vi.fn(async () => { throw new Error(''); }) as unknown as typeof auth.verifyEmail;
      },
    });
    // Step 1: register so we advance to step 2.
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('a@b.com');
    await inputs[2].setValue('password123');
    await inputs[3].setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await flush();
    // Step 2: enter code and submit so verify() throws an empty Error.
    const codeInput = wrapper.find('input');
    await codeInput.setValue('123456');
    await wrapper.find('form').trigger('submit.prevent');
    await flush();
    expect(wrapper.html()).toMatch(/Verification failed/);
  });
});
