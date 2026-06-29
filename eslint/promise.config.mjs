import promisePlugin from 'eslint-plugin-promise';

export default {
  files: ['**/*.ts'],
  plugins: {
    promise: promisePlugin,
  },
  rules: {
    // Require promise chains to return values.
    'promise/always-return': 'error',
    // Require promise chains to end with catch or return.
    'promise/catch-or-return': 'error',
    // Avoid mixing callback and promise styles.
    'promise/no-callback-in-promise': 'error',
    // Prevent resolving or rejecting the same promise multiple times.
    'promise/no-multiple-resolved': 'error',
    // Keep promise chains readable and flat.
    'promise/no-nesting': 'error',
    // Disallow using new with Promise static methods.
    'promise/no-new-statics': 'error',
    // Avoid creating promises inside callback APIs.
    'promise/no-promise-in-callback': 'error',
    // Avoid wrapping values in unnecessary resolved/rejected promises.
    'promise/no-return-wrap': 'error',
    // Require standard resolve/reject parameter names.
    'promise/param-names': 'error',
    // Prefer await over then for clearer async flow.
    'promise/prefer-await-to-then': 'error',
  },
};
