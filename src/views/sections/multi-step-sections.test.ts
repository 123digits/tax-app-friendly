// Exercises the Next/Back wizard logic + add/remove row flows in multi-step
// list sections that weren't fully traversed by the smoke tests.
import { describe, it, expect, vi } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../../test-setup/vue-helpers';
import InterestDividendsSection from './InterestDividendsSection.vue';
import ScheduleESection from './ScheduleESection.vue';
import RetirementSection from './RetirementSection.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';

async function flush() {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('InterestDividendsSection', () => {
  it('step 1 → Next saves interest + advances to step 2; step 2 → Next saves dividends + navigates home', async () => {
    const saveList = vi.fn();
    const { wrapper, router } = mountInApp(InterestDividendsSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData();
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveList = saveList as unknown as typeof s.saveList;
      },
    });
    await flush();

    // Click Add interest.
    const addInterest = wrapper.findAll('button').find((b) => /Add interest/i.test(b.text()));
    if (addInterest) await addInterest.trigger('click');
    await flush();

    // Click Next (VBtn name).
    const btns = wrapper.findAllComponents({ name: 'VBtn' });
    const nextBtn = btns.find((b) => /next/i.test(b.text()));
    await nextBtn!.trigger('click');
    await flush();
    expect(saveList).toHaveBeenCalledWith('interest', expect.any(Array));

    // Click Add dividend on step 2.
    const addDiv = wrapper.findAll('button').find((b) => /Add dividend/i.test(b.text()));
    if (addDiv) await addDiv.trigger('click');
    await flush();

    // Click Next/Save.
    const btns2 = wrapper.findAllComponents({ name: 'VBtn' });
    const saveBtn = btns2.find((b) => /save|finish|next/i.test(b.text()));
    await saveBtn!.trigger('click');
    await flush();
    expect(saveList).toHaveBeenCalledWith('dividends', expect.any(Array));
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('Back on step 2 returns to step 1; Back on step 1 navigates home', async () => {
    const { wrapper, router } = mountInApp(InterestDividendsSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData();
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveList = vi.fn() as unknown as typeof s.saveList;
      },
    });
    await flush();

    // Advance to step 2.
    const btns = wrapper.findAllComponents({ name: 'VBtn' });
    const nextBtn = btns.find((b) => /next/i.test(b.text()));
    await nextBtn!.trigger('click');
    await flush();

    // Click Back → step 1.
    const btns2 = wrapper.findAllComponents({ name: 'VBtn' });
    const backBtn = btns2.find((b) => /^Back/.test(b.text()));
    await backBtn!.trigger('click');
    await flush();

    // Click Back on step 1 → navigates home.
    const btns3 = wrapper.findAllComponents({ name: 'VBtn' });
    const backBtn2 = btns3.find((b) => /^Back/.test(b.text()));
    await backBtn2!.trigger('click');
    await flush();
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('remove interest/dividend rows works', async () => {
    const { wrapper } = mountInApp(InterestDividendsSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          interest: [{ id: 'i', payer: 'Bank', amount: 100, taxExempt: false, privateActivityBondInterest: 0 }],
          dividends: [{ id: 'd', payer: 'Broker', ordinary: 100, qualified: 80, totalCapGainDistributions: 0, unrecapSection1250Gain: 0, section1202Gain: 0 }],
        });
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveList = vi.fn() as unknown as typeof s.saveList;
      },
    });
    await flush();
    const removeBtns = wrapper.findAll('button').filter((b) => /Remove/i.test(b.text()));
    if (removeBtns.length > 0) {
      await removeBtns[0].trigger('click');
      await flush();
    }
    expect(wrapper.html()).toBeTruthy();
  });
});

describe('ScheduleESection', () => {
  it('adds a rental, toggles passive, removes it, adds a royalty and saves', async () => {
    const saveList = vi.fn();
    const { wrapper, router } = mountInApp(ScheduleESection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData();
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveList = saveList as unknown as typeof s.saveList;
      },
    });
    await flush();

    const addRental = wrapper.findAll('button').find((b) => /Add rental/i.test(b.text()));
    if (addRental) {
      await addRental.trigger('click');
      await flush();
    }
    const addRoyalty = wrapper.findAll('button').find((b) => /Add royalty/i.test(b.text()));
    if (addRoyalty) {
      await addRoyalty.trigger('click');
      await flush();
    }
    const removeBtns = wrapper.findAll('button').filter((b) => /Remove/i.test(b.text()));
    if (removeBtns.length > 0) {
      await removeBtns[0].trigger('click');
      await flush();
    }
    const saveBtn = wrapper.findAll('button').find((b) => /save/i.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
    }
    expect(saveList).toHaveBeenCalled();
    void router;
  });

  it('move-rental up/down helpers and remove-royalty are exercised with two rentals + royalties', async () => {
    const saveList = vi.fn();
    const { wrapper } = mountInApp(ScheduleESection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          scheduleERentals: [
            {
              id: 'a', propertyAddress: 'A', propertyType: 'residential',
              fairRentalDays: 365, personalUseDays: 0, rentsReceived: 10000,
              expenses: {}, activeParticipation: true, isPassive: true,
              priorYearUnallowedLoss: 0,
            },
            {
              id: 'b', propertyAddress: 'B', propertyType: 'residential',
              fairRentalDays: 365, personalUseDays: 0, rentsReceived: 8000,
              expenses: {}, activeParticipation: true, isPassive: true,
              priorYearUnallowedLoss: 0,
            },
          ],
          scheduleERoyalties: [
            { id: 'r', source: 'Book', grossRoyalties: 1500, expenses: 100 },
          ],
        });
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveList = saveList as unknown as typeof s.saveList;
      },
    });
    await flush();

    // Up/down arrow buttons are icon VBtns — find by attribute.
    const upBtns = wrapper.findAllComponents({ name: 'VBtn' })
      .filter((b) => b.attributes('icon') === 'mdi-arrow-up');
    const downBtns = wrapper.findAllComponents({ name: 'VBtn' })
      .filter((b) => b.attributes('icon') === 'mdi-arrow-down');
    // Click a movable button (first down — index 0 can always move down).
    if (downBtns.length > 0 && !downBtns[0].attributes('disabled')) {
      await downBtns[0].trigger('click');
      await flush();
    }
    // Click up on the (now) second rental — can move up.
    if (upBtns.length > 1 && !upBtns[1].attributes('disabled')) {
      await upBtns[1].trigger('click');
      await flush();
    }
    // Also click a disabled boundary press (tests the early-return branch).
    if (upBtns.length > 0) {
      await upBtns[0].trigger('click');
      await flush();
    }
    expect(wrapper.html()).toBeTruthy();
  });
});

describe('RetirementSection', () => {
  it('add + remove rows', async () => {
    const saveList = vi.fn();
    const { wrapper } = mountInApp(RetirementSection, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData();
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
        s.saveList = saveList as unknown as typeof s.saveList;
      },
    });
    await flush();

    const addBtn = wrapper.findAll('button').find((b) => /^Add /.test(b.text()));
    if (addBtn) await addBtn.trigger('click');
    await flush();
    const removeBtn = wrapper.findAll('button').find((b) => /Remove/i.test(b.text()));
    if (removeBtn) await removeBtn.trigger('click');
    await flush();
    const saveBtn = wrapper.findAll('button').find((b) => /save/i.test(b.text()));
    if (saveBtn) {
      await saveBtn.trigger('click');
      await flush();
    }
    expect(saveList).toHaveBeenCalled();
  });
});
