import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/out/**',
      '**/dist/**',
      'test-corpus/**',
      'assets/**'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Plain Node scripts (build helpers) use Node globals
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly'
      }
    }
  },
  prettier
)
