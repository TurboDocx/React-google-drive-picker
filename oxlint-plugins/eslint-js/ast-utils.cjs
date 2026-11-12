"use strict";

// The subset of ESLint 7.32.0's lib/rules/utils/ast-utils.js (MIT, see LICENSE) that the vendored
// rules use, copied unchanged.

function isSemicolonToken(token) {
    return token.value === ";" && token.type === "Punctuator";
}

function isClosingBraceToken(token) {
    return token.value === "}" && token.type === "Punctuator";
}

module.exports = { isClosingBraceToken, isSemicolonToken };
