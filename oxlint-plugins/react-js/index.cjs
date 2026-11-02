'use strict';

// eslint-plugin-react 7.32.2 rules (MIT, see LICENSE) that Oxlint has no native version of, vendored
// so the checks plugin:react/recommended enforced keep running without ESLint in the tree.
module.exports = {
  meta: { name: 'react-js' },
  rules: {
    'no-deprecated': require('./rules/no-deprecated.cjs'),
  },
};
