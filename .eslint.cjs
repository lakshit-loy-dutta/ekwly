/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'plugin:astro/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-refresh'],
  root: true,
  env: {
    browser: true,
    es2020: true,
  },
  overrides: [
    {
      // Specifically route .astro files to the Astro parser
      files: ['*.astro'],
      parser: 'astro-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        extraFileExtensions: ['.astro'],
      },
    },
    {
      // Turn off React-in-scope requirement for modern React 17+
      files: ['*.tsx', '*.jsx'],
      rules: {
        'react/react-in-jsx-scope': 'off',
      },
    }
  ],
};