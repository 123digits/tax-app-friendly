// Flat config for ESLint v9. Lints both the Vue client (src/) and the
// Express server (server/), with shared types (shared/) used by both.
//
// SonarQube's JS/TS rule set is applied locally via eslint-plugin-sonarjs,
// so the same "cognitive complexity", "duplicated blocks", "identical
// functions", and bug-pattern checks a SonarCloud run would report show up
// here as lint errors. That makes them enforceable in the same `npm run
// lint` gate rather than waiting on a server-side analysis step.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/*.d.ts',
      'coverage/**',
      'e2e/**',
      '.stryker-tmp/**',
      'reports/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  sonarjs.configs.recommended,
  {
    // Test files run through many scenarios and deliberately repeat
    // scaffolding setups (fake users, fake returns, etc.). Sonar's
    // "no-duplicate-string" and "cognitive-complexity" rules false-positive
    // heavily here, so we loosen both for *.test.ts.
    files: ['**/*.test.ts', 'test-setup/**/*.ts'],
    rules: {
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-identical-functions': 'off',
      'sonarjs/no-identical-expressions': 'off',
      'sonarjs/no-nested-functions': 'off',
      // `void x;` is our idiom for "I destructured this but don't use it" —
      // in a test fixture that's not a smell.
      'sonarjs/void-use': 'off',
      // Some tests deliberately have no assertion (e.g. "does not throw")
      // because mounting-without-crashing is the assertion.
      'sonarjs/assertions-in-tests': 'off',
    },
  },
  {
    // Server + shared TS files run under Node.
    files: ['server/**/*.ts', 'shared/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Client TS files run in the browser.
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    // Vue SFCs: use vue-eslint-parser with the TS parser for <script lang="ts">.
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    // Test files run under Node + Vitest.
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Vite + build config files run under Node.
    files: ['vite.config.ts', 'vitest.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Project-wide rule overrides.
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/attribute-hyphenation': 'off',
      // --- SonarJS rule tuning (project-specific rationale) ---
      // `void x;` is our established idiom for "intentionally unused —
      // don't warn about this destructured/assigned binding." Used in a
      // handful of calculator modules where the binding is declared for
      // clarity even when unread on this code path.
      'sonarjs/void-use': 'off',
      // Pulled in by the dev .env parser and the SSN/currency regex —
      // inputs are bounded and user-controlled only (self-hosted dev
      // machine), so the polynomial-time concern doesn't apply.
      'sonarjs/slow-regex': 'off',
      // `^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)?\s*$` in the .env parser matches
      // empty values legitimately (e.g. `EMPTY=`), so empty-string
      // repetition is intentional.
      'sonarjs/empty-string-repetition': 'off',
      // SHA-1 in pglite.ts hashes a filesystem path to pick a fallback
      // temp dir — no security claim attached.
      'sonarjs/hashing': 'off',
      // We keep CSP disabled in the dev express helmet config because
      // Vite's dev server injects scripts that would otherwise be blocked.
      // Production config is handled separately.
      'sonarjs/content-security-policy': 'off',
      // Cognitive-complexity threshold is 15 by default — some tax-form
      // computations genuinely need more branches than that. Raise to 25
      // and rely on code review for the rest.
      'sonarjs/cognitive-complexity': ['error', 25],
    },
  },
];
