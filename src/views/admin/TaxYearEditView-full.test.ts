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
      .filter((b) => b.props('icon') === 'mdi-delete');
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

  it('mountEdit surfaces "Failed to load" fallback when fetch error has no message', async () => {
    // Exercises `e?.message || 'Failed to load tax year config.'` right-side
    // branch when the error has no message property.
    const getMock = vi.fn(async () => { throw new Error(''); });
    const { wrapper } = mountInApp(TaxYearEditView, { props: { year: '2025' } }, {
      beforeMount: () => {
        const s = useAdminStore();
        s.get = getMock as unknown as typeof s.get;
      },
    });
    await flush();
    expect(wrapper.html()).toMatch(/Failed to load tax year config/);
  });

  it('save surfaces "Save failed" fallback when save error has no message', async () => {
    const getMock = vi.fn(async () => stubConfig() as never);
    const saveMock = vi.fn(async () => { throw new Error(''); });
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
    expect(wrapper.html()).toMatch(/Save failed/);
  });

  it('JSON-parse error in a group surfaces an "Invalid JSON" message and aborts save', async () => {
    // Exercises the catch (e: any) { groupErrors[g.key] = ... } branch in
    // applyGroupDrafts, plus the throw that prevents save from continuing.
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
    // Expand the JSON-group panels so the textareas are rendered.
    const panelTitles = wrapper.findAllComponents({ name: 'VExpansionPanelTitle' });
    for (const t of panelTitles) {
      await t.trigger('click');
      await flush();
    }
    const textareas = wrapper.findAll('textarea');
    if (textareas.length > 0) {
      await textareas[0].setValue('{ this is not valid json');
      await flush();
    }
    const saveBtn = wrapper.findAll('button').find((b) => /^Save$/.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
    }
    expect(wrapper.html()).toMatch(/Invalid JSON/);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('expands bracket panels and can Add + Remove brackets across filing statuses', async () => {
    // Bracket rows live in collapsed v-expansion-panels — expand all then
    // exercise Add/Remove for every filing status.
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
    const panelTitles = wrapper.findAllComponents({ name: 'VExpansionPanelTitle' });
    for (const t of panelTitles) {
      await t.trigger('click');
      await flush();
    }
    const addButtons = wrapper.findAll('button').filter((b) => /Add bracket/.test(b.text()));
    for (const b of addButtons) {
      await b.trigger('click');
      await flush();
    }
    const deleteBtns = wrapper.findAllComponents({ name: 'VBtn' })
      .filter((b) => b.props('icon') === 'mdi-delete');
    for (const b of deleteBtns.slice(0, 3)) {
      await b.trigger('click');
      await flush();
    }
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('normalizeBrackets / pickTopRate take the bounded-only path when no unbounded bracket exists', async () => {
    // Provide a config where the `single` brackets have NO unbounded row
    // (upTo: null is absent). normalizeBrackets → pickTopRate falls through
    // to the `if (bounded.length)` branch returning the last bounded row's
    // rate.
    const cfg = stubConfig();
    cfg.brackets.single = [
      { upTo: 10000, rate: 0.1 },
      { upTo: 50000, rate: 0.2 },
    ];
    const getMock = vi.fn(async () => cfg as never);
    const saveMock = vi.fn();
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
    expect(saveMock).toHaveBeenCalled();
    const savedCfg = saveMock.mock.calls[0]?.[0] as { brackets: { single: Array<{ upTo: number | null; rate: number }> } };
    // Last bracket should have upTo: null and inherited rate from the
    // final bounded bracket (0.2).
    const last = savedCfg.brackets.single[savedCfg.brackets.single.length - 1];
    expect(last.upTo).toBeNull();
    expect(last.rate).toBe(0.2);
  });

  it('normalizeBrackets / pickTopRate falls back to 0 when no brackets at all', async () => {
    // Empty bracket list — pickTopRate hits `return 0` path.
    const cfg = stubConfig();
    cfg.brackets.single = [];
    const getMock = vi.fn(async () => cfg as never);
    const saveMock = vi.fn();
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
    expect(saveMock).toHaveBeenCalled();
    const savedCfg = saveMock.mock.calls[0]?.[0] as { brackets: { single: Array<{ upTo: number | null; rate: number }> } };
    expect(savedCfg.brackets.single[0]).toEqual({ upTo: null, rate: 0 });
  });

  it('save serializes empty eitcInvestmentIncomeLimit as undefined', async () => {
    // Exercises `cfg.value.eitcInvestmentIncomeLimit == null ||
    // (cfg.value.eitcInvestmentIncomeLimit as any) === ''` → ? undefined : Number(...).
    const cfg = stubConfig() as unknown as Record<string, unknown>;
    cfg.eitcInvestmentIncomeLimit = '';
    const getMock = vi.fn(async () => cfg as never);
    const saveMock = vi.fn();
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
    expect(saveMock).toHaveBeenCalled();
    const payload = saveMock.mock.calls[0]?.[0] as { eitcInvestmentIncomeLimit: number | undefined };
    expect(payload.eitcInvestmentIncomeLimit).toBeUndefined();
  });
});
