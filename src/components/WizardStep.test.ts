import { describe, it, expect } from 'vitest';
import { mountWith } from '../../test-setup/vue-helpers';
import WizardStep from './WizardStep.vue';

describe('WizardStep', () => {
  it('renders title and step indicator', () => {
    const { wrapper } = mountWith(WizardStep, {
      props: { title: 'My Step', step: 2, totalSteps: 4 },
    });
    expect(wrapper.html()).toContain('My Step');
    expect(wrapper.html()).toContain('Step 2 of 4');
  });

  it('emits back and next events when buttons clicked', async () => {
    const { wrapper } = mountWith(WizardStep, {
      props: { title: 'T', step: 1, totalSteps: 1, canBack: true, canNext: true },
    });
    const buttons = wrapper.findAllComponents({ name: 'VBtn' });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    await buttons[0].trigger('click');
    await buttons[1].trigger('click');
    expect(wrapper.emitted('back')).toBeTruthy();
    expect(wrapper.emitted('next')).toBeTruthy();
  });

  it('disables back when canBack is false', () => {
    const { wrapper } = mountWith(WizardStep, {
      props: { title: 'T', step: 1, totalSteps: 1, canBack: false, canNext: true },
    });
    const html = wrapper.html();
    expect(html).toMatch(/disabled/);
  });

  it('disables next when canNext is false', () => {
    const { wrapper } = mountWith(WizardStep, {
      props: { title: 'T', step: 1, totalSteps: 1, canBack: true, canNext: false },
    });
    const html = wrapper.html();
    expect(html).toMatch(/disabled/);
  });

  it('uses custom nextLabel', () => {
    const { wrapper } = mountWith(WizardStep, {
      props: { title: 'T', step: 1, totalSteps: 1, nextLabel: 'Finish' },
    });
    expect(wrapper.html()).toContain('Finish');
  });
});
