import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'SquadJS/',
    ],
  },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      'brace-style': 'error',
      'comma-dangle': ['error', 'always-multiline'],
      curly: 'error',
      indent: [
        'error',
        2,
      ],
      'no-multi-spaces': 'error',
      'no-unneeded-ternary': 'error',
      'object-curly-spacing': ['error', 'always'],
      quotes: ['error', 'single'],
      'space-before-blocks': [
        'error',
        {
          classes: 'always',
          keywords: 'always',
          functions: 'always',
        },
      ],
    },
  },
);
