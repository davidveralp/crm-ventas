module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['local'],
  rules: {
    // Variable inexistente → ReferenceError (caso v80).
    'no-undef': 'error',
    // Variable usada durante el render antes de declararse → "Cannot access
    // before initialization" (caso v82). La regla propia ignora las
    // referencias dentro de callbacks, que sí son válidas.
    'local/tdz-en-render': 'error'
  },
  settings: {},
  globals: { React: 'readonly' }
}
