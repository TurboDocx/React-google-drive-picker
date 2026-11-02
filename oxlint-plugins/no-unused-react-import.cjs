"use strict";

// ESLint's no-unused-vars reported `import React from "react"` in a file with no JSX, because
// eslint-plugin-react's jsx-uses-react only marks React as used where JSX appears. Oxlint's
// no-unused-vars treats a React import as used in any file that may contain JSX (.js, .jsx, .tsx),
// JSX or not, so this rule reports the case it lets through. In .ts files Oxlint reports it itself.
const REACT_MODULE = "react";
const PRAGMA = "React";

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow a React import that a file without JSX never uses." },
    messages: { unused: "'{{name}}' is defined but never used." },
    schema: [],
  },
  create(context) {
    if (/\.[cm]?ts$/u.test(context.filename)) {
      return {};
    }
    let hasJsx = false;
    const specifiers = [];
    const collect = (node) => {
      if (node.parent.source.value === REACT_MODULE && node.local.name === PRAGMA) {
        specifiers.push(node);
      }
    };
    return {
      ImportDefaultSpecifier: collect,
      ImportNamespaceSpecifier: collect,
      JSXElement() {
        hasJsx = true;
      },
      JSXFragment() {
        hasJsx = true;
      },
      "Program:exit"() {
        if (hasJsx) {
          return;
        }
        specifiers.forEach((specifier) => {
          const [variable] = context.sourceCode.getDeclaredVariables(specifier);
          if (variable && variable.references.length === 0) {
            context.report({ node: specifier.local, messageId: "unused", data: { name: specifier.local.name } });
          }
        });
      },
    };
  },
};

module.exports = {
  meta: { name: "turbodocx" },
  rules: { "no-unused-react-import": rule },
};
