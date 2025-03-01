import globals from 'globals';
import pluginJs from '@eslint/js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'SquadJS/',
    ],
  },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  pluginJs.configs.recommended,
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
];
