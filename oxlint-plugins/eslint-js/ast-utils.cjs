"use strict";

// The subset of ESLint 7.32.0's lib/rules/utils/ast-utils.js (MIT, see LICENSE) that the vendored
// rules use, copied unchanged.

const anyFunctionPattern = /^(?:Function(?:Declaration|Expression)|ArrowFunctionExpression)$/u;

function getUpperFunction(node) {
    for (let currentNode = node; currentNode; currentNode = currentNode.parent) {
        if (anyFunctionPattern.test(currentNode.type)) {
            return currentNode;
        }
    }
    return null;
}

function isSemicolonToken(token) {
    return token.value === ";" && token.type === "Punctuator";
}

function isClosingBraceToken(token) {
    return token.value === "}" && token.type === "Punctuator";
}

module.exports = { getUpperFunction, isClosingBraceToken, isSemicolonToken };
