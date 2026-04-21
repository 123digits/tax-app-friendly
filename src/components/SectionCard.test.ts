import { describe, it, expect } from 'vitest';
import { mountWith, stubTaxStoreData } from '../../test-setup/vue-helpers';
import SectionCard from './SectionCard.vue';
import type { SectionConfig } from '../config/sections';

function mkSection(partial: Partial<SectionConfig> = {}): SectionConfig {
  return {
    id: 'x',
    title: 'Sec',
    subtitle: 'Sub',
    icon: 'mdi-cog',
    route: '/section/x',
    stepCount: 2,
    progress: () => 1,
    ...partial,
  };
}

describe('SectionCard', () => {
  it('renders title and subtitle', () => {
    const { wrapper } = mountWith(SectionCard, {
      props: { section: mkSection(), ret: stubTaxStoreData() },
    });
    expect(wrapper.html()).toContain('Sec');
    expect(wrapper.html()).toContain('Sub');
    expect(wrapper.html()).toContain('1 of 2 steps');
  });

  it('renders complete state', () => {
    const { wrapper } = mountWith(SectionCard, {
      props: {
        section: mkSection({ progress: () => 2, stepCount: 2 }),
        ret: stubTaxStoreData(),
      },
    });
    expect(wrapper.html()).toContain('2 of 2');
  });

  it('navigates on click', async () => {
    const { wrapper, router } = mountWith(SectionCard, {
      props: { section: mkSection({ route: '/section/x' }), ret: stubTaxStoreData() },
    });
    await wrapper.find('.v-card').trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    expect(router.currentRoute.value.path).toBe('/section/x');
  });
});
