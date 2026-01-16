const expoConfig = require('eslint-config-expo/flat')

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-console': 'error',
      'no-empty': 'error',
      'prefer-const': 'error',
      'no-empty-pattern': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'import/first': 'off',
    },
  },
  {
    files: ['jest.setup.js', '__tests__/**/*.ts', '__tests__/**/*.tsx'],
    languageOptions: {
      globals: {
        jest: 'readonly',
      },
    },
  },
]
