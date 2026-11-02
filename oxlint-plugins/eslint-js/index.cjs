"use strict";

// ESLint 7.32.0 core rules (MIT, see LICENSE) that Oxlint has no native version of, vendored so the
// checks the ESLint config enforced keep running without ESLint in the dependency tree. The rule
// files are ESLint's, ported to the API Oxlint exposes (context.sourceCode).
module.exports = {
    meta: { name: "eslint-js" },
    rules: {
        "no-extra-semi": require("./rules/no-extra-semi.cjs")
    }
};
