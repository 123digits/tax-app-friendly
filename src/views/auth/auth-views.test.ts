import { describe, it, expect, vi } from 'vitest';
import { mountInApp } from '../../../test-setup/vue-helpers';
import LoginView from './LoginView.vue';
import RegisterView from './RegisterView.vue';
import TwoFactorView from './TwoFactorView.vue';
import { useAuthStore } from '../../stores/auth';

describe('LoginView', () => {
  it('mounts and allows typing username + password', async () => {
    const { wrapper } = mountInApp(LoginView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.login = vi.fn(async () => ({ ok: true, twoFactorRequired: true, email: 'x@y' })) as unknown as typeof auth.login;
      },
    });
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('password123');
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Sign in'));
    await btn!.trigger('click');
  });

  it('navigates to two-factor after successful login', async () => {
    const { wrapper, router } = mountInApp(LoginView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.login = vi.fn(async () => ({ ok: true, twoFactorRequired: true, email: 'x@y' })) as unknown as typeof auth.login;
      },
    });
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('password123');
    const form = wrapper.find('form');
    await form.trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(router.currentRoute.value.name).toBe('two-factor');
  });

  it('navigates to home when twoFactorRequired is false', async () => {
    const { wrapper, router } = mountInApp(LoginView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.login = vi.fn(async () => ({ ok: true, twoFactorRequired: false, email: 'x@y' })) as unknown as typeof auth.login;
      },
    });
    const form = wrapper.find('form');
    await form.trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('shows invalid_credentials error', async () => {
    const { wrapper } = mountInApp(LoginView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.login = vi.fn(async () => {
          const err = new Error('bad') as Error & { body?: { error?: string } };
          err.body = { error: 'invalid_credentials' };
          throw err;
        }) as unknown as typeof auth.login;
      },
    });
    const form = wrapper.find('form');
    await form.trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/Invalid username or password/);
  });

  it('shows generic error on other failures', async () => {
    const { wrapper } = mountInApp(LoginView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.login = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof auth.login;
      },
    });
    const form = wrapper.find('form');
    await form.trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/boom|Login failed/);
  });

  it('login failure with blank error message falls through to "Login failed."', async () => {
    // Exercises the `e?.message || 'Login failed.'` right-side branch.
    const { wrapper } = mountInApp(LoginView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.login = vi.fn(async () => { throw new Error(''); }) as unknown as typeof auth.login;
      },
    });
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/Login failed/);
  });
});

describe('RegisterView', () => {
  it('mounts and shows step 1', () => {
    const { wrapper } = mountInApp(RegisterView);
    expect(wrapper.html()).toContain('Create account');
  });

  it('shows error on short password', async () => {
    const { wrapper } = mountInApp(RegisterView);
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('a@b.com');
    await inputs[2].setValue('short');
    await inputs[3].setValue('short');
    const form = wrapper.find('form');
    await form.trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/at least 8/);
  });

  it('shows error on password mismatch', async () => {
    const { wrapper } = mountInApp(RegisterView);
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('a@b.com');
    await inputs[2].setValue('password123');
    await inputs[3].setValue('different1');
    const form = wrapper.find('form');
    await form.trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/do not match/);
  });

  it('advances to step 2 on successful register', async () => {
    const { wrapper } = mountInApp(RegisterView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.register = vi.fn(async () => { /* noop */ }) as unknown as typeof auth.register;
      },
    });
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('a@b.com');
    await inputs[2].setValue('password123');
    await inputs[3].setValue('password123');
    const form = wrapper.find('form');
    await form.trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/Verify email/);
  });

  it('verifies code and navigates to login', async () => {
    const { wrapper, router } = mountInApp(RegisterView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.register = vi.fn(async () => { /* noop */ }) as unknown as typeof auth.register;
        auth.verifyEmail = vi.fn(async () => { /* noop */ }) as unknown as typeof auth.verifyEmail;
      },
    });
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('a@b.com');
    await inputs[2].setValue('password123');
    await inputs[3].setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    // Now on step 2 - fill code, submit.
    const code = wrapper.find('input');
    await code.setValue('123456');
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('shows user_exists error', async () => {
    const { wrapper } = mountInApp(RegisterView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.register = vi.fn(async () => {
          const e = new Error('exists') as Error & { body?: { error?: string } };
          e.body = { error: 'user_exists' };
          throw e;
        }) as unknown as typeof auth.register;
      },
    });
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('a@b.com');
    await inputs[2].setValue('password123');
    await inputs[3].setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/already in use/);
  });

  it('shows validation_failed error', async () => {
    const { wrapper } = mountInApp(RegisterView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.register = vi.fn(async () => {
          const e = new Error('v') as Error & { body?: { error?: string } };
          e.body = { error: 'validation_failed' };
          throw e;
        }) as unknown as typeof auth.register;
      },
    });
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('a');
    await inputs[1].setValue('a@b.com');
    await inputs[2].setValue('password123');
    await inputs[3].setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/check your input/);
  });

  it('verify email failure surfaces error message (step 2 catch block)', async () => {
    // Exercises the `} catch (e: any) { error.value = e?.message || ... }`
    // block inside the verify() step-2 handler.
    const { wrapper } = mountInApp(RegisterView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.register = vi.fn(async () => { /* noop */ }) as unknown as typeof auth.register;
        auth.verifyEmail = vi.fn(async () => { throw new Error('bad code'); }) as unknown as typeof auth.verifyEmail;
      },
    });
    // Step 1 submit.
    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('alice');
    await inputs[1].setValue('a@b.com');
    await inputs[2].setValue('password123');
    await inputs[3].setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    // Step 2 verify.
    const codeInput = wrapper.find('input');
    await codeInput.setValue('123456');
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/bad code|Verification failed/);
  });
});

describe('TwoFactorView', () => {
  it('mounts and allows code entry + submit', async () => {
    const { wrapper, router } = mountInApp(TwoFactorView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.verifyTwoFactor = vi.fn(async () => { /* noop */ }) as unknown as typeof auth.verifyTwoFactor;
      },
    });
    const input = wrapper.find('input');
    await input.setValue('123456');
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('shows reason-specific error messages', async () => {
    for (const reason of ['expired', 'wrong', 'consumed', 'locked', 'not_found']) {
      const { wrapper } = mountInApp(TwoFactorView, {}, {
        beforeMount: () => {
          const auth = useAuthStore();
          auth.verifyTwoFactor = vi.fn(async () => {
            const e = new Error('x') as Error & { body?: { reason?: string } };
            e.body = { reason };
            throw e;
          }) as unknown as typeof auth.verifyTwoFactor;
        },
      });
      await wrapper.find('form').trigger('submit.prevent');
      await new Promise((r) => setTimeout(r, 0));
      expect(wrapper.html()).toMatch(/[Cc]ode|attempts|[Nn]o active/);
    }
  });

  it('resend success shows info alert', async () => {
    const { wrapper } = mountInApp(TwoFactorView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.resendTwoFactor = vi.fn(async () => { /* noop */ }) as unknown as typeof auth.resendTwoFactor;
      },
    });
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Resend'));
    await btn!.trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/A new code has been sent/);
  });

  it('resend failure shows error', async () => {
    const { wrapper } = mountInApp(TwoFactorView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.resendTwoFactor = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof auth.resendTwoFactor;
      },
    });
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Resend'));
    await btn!.trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/boom|Could not/);
  });

  it('verify with unknown reason falls through to e.message', async () => {
    // Exercises `map[reason] || e?.message || 'Verification failed.'`
    // middle branch when reason isn't in the map but the error has a
    // message.
    const { wrapper } = mountInApp(TwoFactorView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.verifyTwoFactor = vi.fn(async () => {
          const e = new Error('custom server error') as Error & { body?: { reason?: string } };
          e.body = { reason: 'some-unknown-reason' };
          throw e;
        }) as unknown as typeof auth.verifyTwoFactor;
      },
    });
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/custom server error/);
  });

  it('verify with no reason and no message falls through to "Verification failed."', async () => {
    // Exercises the final default `'Verification failed.'` branch.
    const { wrapper } = mountInApp(TwoFactorView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.verifyTwoFactor = vi.fn(async () => { throw new Error(''); }) as unknown as typeof auth.verifyTwoFactor;
      },
    });
    await wrapper.find('form').trigger('submit.prevent');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/Verification failed/);
  });

  it('resend failure with no message falls through to "Could not send a new code."', async () => {
    const { wrapper } = mountInApp(TwoFactorView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.resendTwoFactor = vi.fn(async () => { throw new Error(''); }) as unknown as typeof auth.resendTwoFactor;
      },
    });
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Resend'));
    await btn!.trigger('click');
    await new Promise((r) => setTimeout(r, 0));
    expect(wrapper.html()).toMatch(/Could not send/);
  });

  it('shows pending email in subtitle', () => {
    const { wrapper } = mountInApp(TwoFactorView, {}, {
      beforeMount: () => {
        const auth = useAuthStore();
        auth.pendingEmail = 'user@example.com';
      },
    });
    expect(wrapper.html()).toContain('user@example.com');
  });
});
