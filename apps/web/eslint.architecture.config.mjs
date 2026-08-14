import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const restrictedLayers = (groups) => [
  'error',
  {
    patterns: groups.map((group) => ({
      group: [`**/${group}/**`, `@/**/${group}/**`],
      message: `The current layer must not depend on ${group}.`,
    })),
  },
];

export default defineConfig([
  globalIgnores(['.next/**', 'coverage/**']),
  ...tseslint.configs.recommended,
  {
    files: ['src/features/**/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedLayers(['application', 'infrastructure', 'presentation']),
    },
  },
  {
    files: ['src/features/**/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedLayers(['infrastructure', 'presentation']),
    },
  },
  {
    files: ['src/features/**/infrastructure/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedLayers(['presentation']),
    },
  },
]);
