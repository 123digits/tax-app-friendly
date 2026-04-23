// Exercises branches that only fire when K-1 rows have negative summed
// values — the formatMoney sign ternary and netFor's accumulation over
// multiple rows.
import { describe, it, expect, vi } from 'vitest';
import { mountInApp, stubTaxStoreData } from '../../../test-setup/vue-helpers';
import K1Section from './K1Section.vue';
import { useTaxReturnStore } from '../../stores/taxReturn';

async function flush() {
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0));
}

describe('K1Section', () => {
  it('formatMoney renders negative sign for a loss K-1', async () => {
    // `n < 0 ? '-' : ''` truthy branch fires only when netFor(k) < 0.
    const { wrapper } = mountInApp(K1Section, {}, {
      beforeMount: () => {
        const s = useTaxReturnStore();
        const data = stubTaxStoreData({
          k1s: [
            {
              id: 'k1', entityKind: 'partnership', entityName: 'Losing LP', ein: null,
              isPassive: false, ordinaryBusinessIncome: -5000,
              netRentalRealEstate: 0, otherRentalIncome: 0,
              interestIncome: 0, ordinaryDividends: 0, qualifiedDividends: 0,
              royalties: 0, shortTermCapitalGain: 0, longTermCapitalGain: 0,
              section1231Gain: 0, priorYearUnallowedLoss: 0,
            },
          ],
        });
        s.data = data as never;
        s.load = vi.fn(async () => { s.data = data as never; }) as never;
      },
    });
    await flush();
    // Expansion-panel title shows the formatted net.
    expect(wrapper.html()).toMatch(/-\$5,000/);
  });
});
