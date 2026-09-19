import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-output/**', 'screenshots/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // tools/ e scripts/ sao CommonJS de Node. Sem isto, `no-undef` de
    // js.configs.recommended reprova `require`, `module`, `process` e `console`
    // — e `scripts/verify.js` nao pode ser alterado para agradar o lint.
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly', module: 'writable', process: 'readonly',
        console: 'readonly', __dirname: 'readonly', exports: 'writable',
      },
    },
    rules: {
      // require() e a forma correta de import em CommonJS, nao um estilo a
      // migrar — a regra e para ESM. scripts/verify.js e scripts/verify-gate.js
      // sao harness pre-existente que a sessao foi instruida a nao reescrever.
      '@typescript-eslint/no-require-imports': 'off',
      // catch {} vazio e o padrao deliberado de "ignora se o arquivo nao
      // existe" usado em scripts/verify.js (unlink de .verify-ok).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['phaser', 'phaser/*'],
            message: 'Invariante 1: src/sim/ nao pode importar phaser.' },
          { group: ['**/render/**', '**/ui/**', '**/input/**'],
            message: 'sim/ nao depende de engine, render ou UI.' },
        ],
      }],
      'no-restricted-globals': ['error',
        { name: 'window', message: 'Invariante 1: sim/ roda em Node, sem DOM.' },
        { name: 'document', message: 'Invariante 1: sim/ roda em Node, sem DOM.' },
        { name: 'performance', message: 'Invariante 2: use o tick, nao o relogio.' },
      ],
      // Invariante 2 (determinismo): nenhuma fonte de nao-determinismo em sim/.
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random',
          message: 'Invariante 2: use o RNG semeado de sim/rng.ts.' },
        { object: 'Date', property: 'now',
          message: 'Invariante 2: use state.tick, nunca o relogio.' },
      ],
    },
  },
  {
    // Convencao de parametro/variavel intencionalmente nao usado: prefixo
    // `_`. Usada em sim/tick.ts, onde `Command` ainda e `never` (F02) e o
    // parametro `_commands` existe so para fixar a assinatura do contrato.
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
);
