import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/shared/api/schema.d.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, __PORTAL__: 'readonly' },
      parserOptions: {
        // Resolves each file through the referenced projects in tsconfig.json,
        // so app sources and build tooling are both covered.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Money is a decimal string from the API. Parsing it into a float to do
      // arithmetic is the single most likely way to introduce a billing bug,
      // so the formatting helpers are the only sanctioned conversion.
      'no-restricted-globals': [
        'error',
        {
          name: 'parseFloat',
          message:
            'Do not parse money. Format it with @/shared/format, and let the API compute totals.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='localStorage']",
          message:
            'Auth lives in an httpOnly cookie and server data lives in React Query. Use the zustand UI store for preferences.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    rules: { '@typescript-eslint/no-unsafe-assignment': 'off' },
  },
);
