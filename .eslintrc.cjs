module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  // react/jsx-no-undef detecta componentes usados sin importar. `no-undef`
  // solo no los ve, y por eso PanelVehiculo llegó a producción: se usaba en
  // Taller.jsx sin el import y solo fallaba al abrir el detalle.
  plugins: ['local', 'react'],
  rules: {
    'react/jsx-no-undef': 'error',
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
