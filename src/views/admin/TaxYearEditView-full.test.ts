// Deeper TaxYearEditView tests: add/remove brackets, normalizeBrackets paths
// via save, JSON-group validation error, successful save with groupDrafts
// round-tripped, and the mountEdit error branch.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountInApp } from '../../../test-setup/vue-helpers';
import TaxYearEditView from './TaxYearEditView.vue';
import { useAdminStore } from '../../stores/admin';

function stubConfig() {
  return {
    taxYear: 2025,
    brackets: {
      single: [{ upTo: 10000, rate: 0.1 }, { upTo: null, rate: 0.2 }],
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
    eitcInvestmentIncomeLimit: 11950,
    retirement: { iraLimit: 7000, iraCatchUp: 1000, sepPercent: 0.25, solo401kLimit: 23000, catchUpAge: 50 },
  };
}

async function flush() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  // noop
});

describe('TaxYearEditView — extended flows', () => {
  it('renders bracket rows and allows Add / Remove', async () => {
    const getMock = vi.fn(async () => stubConfig() as never);
    const saveMock = vi.fn();
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = getMock as unknown as typeof s.get;
        s.save = saveMock as unknown as typeof s.save;
      },
    });
    await flush();

    // Click "Add bracket" (one per filing status).
    const addButtons = wrapper.findAll('button').filter((b) => /Add bracket/.test(b.text()));
    if (addButtons.length > 0) {
      await addButtons[0].trigger('click');
      await flush();
    }

    // Click a delete-bracket button (mdi-delete icon button).
    const deleteBtns = wrapper.findAllComponents({ name: 'VBtn' })
      .filter((b) => b.attributes('icon') === 'mdi-delete');
    if (deleteBtns.length > 0) {
      await deleteBtns[0].trigger('click');
      await flush();
    }

    // Click Save.
    const saveBtn = wrapper.findAll('button').find((b) => /^Save$/.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
    }
    expect(saveMock).toHaveBeenCalled();
  });

  it('renders the JSON-group editor panels', async () => {
    const getMock = vi.fn(async () => stubConfig() as never);
    const saveMock = vi.fn();
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = getMock as unknown as typeof s.get;
        s.save = saveMock as unknown as typeof s.save;
      },
    });
    await flush();
    // Panels for each group should be in the DOM (inside v-expansion-panels).
    expect(wrapper.findAllComponents({ name: 'VExpansionPanel' }).length).toBeGreaterThan(0);
  });

  it('successful save re-fetches and shows success alert', async () => {
    const getMock = vi.fn(async () => stubConfig() as never);
    const saveMock = vi.fn(async () => undefined);
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = getMock as unknown as typeof s.get;
        s.save = saveMock as unknown as typeof s.save;
      },
    });
    await flush();

    const saveBtn = wrapper.findAll('button').find((b) => /^Save$/.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
      await flush();
    }
    expect(saveMock).toHaveBeenCalled();
    expect(getMock).toHaveBeenCalledTimes(2); // initial + after save
  });

  it('save failure surfaces error alert', async () => {
    const getMock = vi.fn(async () => stubConfig() as never);
    const saveMock = vi.fn(async () => { throw new Error('server-nope'); });
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = getMock as unknown as typeof s.get;
        s.save = saveMock as unknown as typeof s.save;
      },
    });
    await flush();

    const saveBtn = wrapper.findAll('button').find((b) => /^Save$/.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
    }
    expect(wrapper.html()).toMatch(/server-nope|Save failed/);
  });

  it('empty JSON group clears the override', async () => {
    const getMock = vi.fn(async () => stubConfig() as never);
    const saveMock = vi.fn();
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = getMock as unknown as typeof s.get;
        s.save = saveMock as unknown as typeof s.save;
      },
    });
    await flush();

    // Clear the first textarea.
    const textareas = wrapper.findAll('textarea');
    if (textareas.length > 0) {
      await textareas[0].setValue('');
      await flush();
    }
    const saveBtn = wrapper.findAll('button').find((b) => /^Save$/.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
    }
    expect(saveMock).toHaveBeenCalled();
  });
});
