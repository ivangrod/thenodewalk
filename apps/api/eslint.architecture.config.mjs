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
  globalIgnores(['dist/**', 'coverage/**']),
  ...tseslint.configs.recommended,
  {
    files: ['src/**/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedLayers(['application', 'infrastructure']),
    },
  },
  {
    files: ['src/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictedLayers(['infrastructure']),
    },
  },
]);
