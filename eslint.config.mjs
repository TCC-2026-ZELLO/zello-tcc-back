import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import pluginSecurity from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist', 'coverage'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // v5.0.0-1.3.2 / 1.2.5 / 1.5.2: regras de SAST para padrões inseguros
  // (eval, child_process, regex vulnerável a ReDoS, require dinâmico etc.).
  pluginSecurity.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // 🛡️ Regras Globais
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // Execução dinâmica de código é proibida (v5.0.0-1.3.2).
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-child-process': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      // Acesso por chave dinâmica gera muitos falsos positivos em TypeScript
      // tipado; os casos reais foram revisados manualmente.
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
);
