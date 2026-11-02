/**
 * @fileoverview Prevent usage of deprecated methods
 * @author Yannick Croissant
 * @author Scott Feeney
 * @author Sergei Startsev
 *
 * Vendored from eslint-plugin-react 7.32.2 (MIT, see ../LICENSE). Its helpers (util/ast,
 * util/componentUtil, util/pragma, util/version, util/report) are inlined below, keeping what this
 * rule uses, so the package and its ESLint peer dependency stay out of the tree.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const values = Object.values;
const docsUrl = (ruleName) => `https://github.com/jsx-eslint/eslint-plugin-react/tree/v7.32.2/docs/rules/${ruleName}.md`;

// util/pragma
const JSX_ANNOTATION_REGEX = /@jsx\s+([^\s]+)/;
const JS_IDENTIFIER_REGEX = /^[_$a-zA-Z][_$a-zA-Z0-9]*$/;
const reactSettings = (context) => (context.settings && context.settings.react) || {};

function getPragma(context) {
  let pragma = 'React';
  const pragmaNode = context.sourceCode.getAllComments().find((node) => JSX_ANNOTATION_REGEX.test(node.value));
  if (pragmaNode) {
    pragma = JSX_ANNOTATION_REGEX.exec(pragmaNode.value)[1].split('.')[0];
  } else if (reactSettings(context).pragma) {
    pragma = reactSettings(context).pragma;
  }
  if (!JS_IDENTIFIER_REGEX.test(pragma)) {
    throw new Error(`React pragma ${pragma} is not a valid identifier`);
  }
  return pragma;
}

function getCreateClass(context) {
  const createClass = reactSettings(context).createClass || 'createReactClass';
  if (!JS_IDENTIFIER_REGEX.test(createClass)) {
    throw new Error(`createClass pragma ${createClass} is not a valid function name`);
  }
  return createClass;
}

// util/version: the configured React version; "detect" reads the installed react package, and a
// missing setting or package means the latest React, as in eslint-plugin-react.
const LATEST = '999.999.999';
function getReactVersion(context) {
  let version = reactSettings(context).version;
  if (!version) {
    return LATEST;
  }
  if (version === 'detect') {
    try {
      const pkg = path.join(context.cwd || process.cwd(), 'node_modules', 'react', 'package.json');
      version = JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
    } catch {
      return LATEST;
    }
  }
  const parts = String(version).split('.').map(Number);
  return [0, 1, 2].map((i) => (Number.isFinite(parts[i]) ? parts[i] : 0)).join('.');
}

// testReactVersion(context, '>= x.y.z')
function testReactVersion(context, range) {
  const wanted = range.replace(/^>=\s*/, '').split('.').map(Number);
  const actual = getReactVersion(context).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (actual[i] !== wanted[i]) {
      return actual[i] > wanted[i];
    }
  }
  return true;
}

// util/ast
function getPropertyNameNode(node) {
  if (node.key || ['MethodDefinition', 'Property'].indexOf(node.type) !== -1) {
    return node.key;
  }
  if (node.type === 'MemberExpression') {
    return node.property;
  }
  return null;
}

function getPropertyName(node) {
  const nameNode = getPropertyNameNode(node);
  return nameNode ? nameNode.name : '';
}

function getComponentProperties(node) {
  switch (node.type) {
    case 'ClassDeclaration':
    case 'ClassExpression':
      return node.body.body;
    case 'ObjectExpression':
      return node.properties;
    default:
      return [];
  }
}

const astUtil = { getComponentProperties, getPropertyName, getPropertyNameNode };

// util/componentUtil
function isES5Component(node, context) {
  const pragma = getPragma(context);
  const createClass = getCreateClass(context);
  if (!node.parent || !node.parent.callee) {
    return false;
  }
  const callee = node.parent.callee;
  if (callee.type === 'MemberExpression') {
    return callee.object.name === pragma && callee.property.name === createClass;
  }
  if (callee.type === 'Identifier') {
    return callee.name === createClass;
  }
  return false;
}

// ESLint 7's SourceCode#getJSDocComment for the node types this rule passes, which Oxlint does not
// provide: the /** */ comment directly above a class (or above the export that declares it).
function getJSDocComment(node, sourceCode) {
  let target = null;
  if (node.type === 'ClassDeclaration') {
    target = /^Export(Default|Named)Declaration$/.test(node.parent.type) ? node.parent : node;
  } else if (node.type === 'ClassExpression') {
    target = node.parent.parent;
  }
  if (!target) {
    return null;
  }
  const before = sourceCode.getTokenBefore(target, { includeComments: true });
  if (before && before.type === 'Block' && before.value.charAt(0) === '*'
    && target.loc.start.line - before.loc.end.line <= 1) {
    return before;
  }
  return null;
}

// A JSDoc `@extends React.Component` or `@augments React.PureComponent` tag, which
// eslint-plugin-react read with doctrine.
function isExplicitComponent(node, context) {
  const comment = getJSDocComment(node, context.sourceCode);
  if (!comment) {
    return false;
  }
  return /@(?:extends|augments)\s+\{?React\.(?:Pure)?Component\}?(?:\s|$)/.test(comment.value);
}

function isES6Component(node, context) {
  const pragma = getPragma(context);
  if (isExplicitComponent(node, context)) {
    return true;
  }
  if (!node.superClass) {
    return false;
  }
  if (node.superClass.type === 'MemberExpression') {
    return node.superClass.object.name === pragma
      && /^(Pure)?Component$/.test(node.superClass.property.name);
  }
  if (node.superClass.type === 'Identifier') {
    return /^(Pure)?Component$/.test(node.superClass.name);
  }
  return false;
}

const componentUtil = { isES5Component, isES6Component };
const pragmaUtil = { getFromContext: getPragma };

// util/report
function report(context, message, messageId, data) {
  context.report(Object.assign({ messageId }, data));
}

// ------------------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------------------

const MODULES = {
  react: ['React'],
  'react-addons-perf': ['ReactPerf', 'Perf'],
};

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

function getDeprecated(pragma) {
  const deprecated = {};
  // 0.12.0
  deprecated[`${pragma}.renderComponent`] = ['0.12.0', `${pragma}.render`];
  deprecated[`${pragma}.renderComponentToString`] = ['0.12.0', `${pragma}.renderToString`];
  deprecated[`${pragma}.renderComponentToStaticMarkup`] = ['0.12.0', `${pragma}.renderToStaticMarkup`];
  deprecated[`${pragma}.isValidComponent`] = ['0.12.0', `${pragma}.isValidElement`];
  deprecated[`${pragma}.PropTypes.component`] = ['0.12.0', `${pragma}.PropTypes.element`];
  deprecated[`${pragma}.PropTypes.renderable`] = ['0.12.0', `${pragma}.PropTypes.node`];
  deprecated[`${pragma}.isValidClass`] = ['0.12.0'];
  deprecated['this.transferPropsTo'] = ['0.12.0', 'spread operator ({...})'];
  // 0.13.0
  deprecated[`${pragma}.addons.classSet`] = ['0.13.0', 'the npm module classnames'];
  deprecated[`${pragma}.addons.cloneWithProps`] = ['0.13.0', `${pragma}.cloneElement`];
  // 0.14.0
  deprecated[`${pragma}.render`] = ['0.14.0', 'ReactDOM.render'];
  deprecated[`${pragma}.unmountComponentAtNode`] = ['0.14.0', 'ReactDOM.unmountComponentAtNode'];
  deprecated[`${pragma}.findDOMNode`] = ['0.14.0', 'ReactDOM.findDOMNode'];
  deprecated[`${pragma}.renderToString`] = ['0.14.0', 'ReactDOMServer.renderToString'];
  deprecated[`${pragma}.renderToStaticMarkup`] = ['0.14.0', 'ReactDOMServer.renderToStaticMarkup'];
  // 15.0.0
  deprecated[`${pragma}.addons.LinkedStateMixin`] = ['15.0.0'];
  deprecated['ReactPerf.printDOM'] = ['15.0.0', 'ReactPerf.printOperations'];
  deprecated['Perf.printDOM'] = ['15.0.0', 'Perf.printOperations'];
  deprecated['ReactPerf.getMeasurementsSummaryMap'] = ['15.0.0', 'ReactPerf.getWasted'];
  deprecated['Perf.getMeasurementsSummaryMap'] = ['15.0.0', 'Perf.getWasted'];
  // 15.5.0
  deprecated[`${pragma}.createClass`] = ['15.5.0', 'the npm module create-react-class'];
  deprecated[`${pragma}.addons.TestUtils`] = ['15.5.0', 'ReactDOM.TestUtils'];
  deprecated[`${pragma}.PropTypes`] = ['15.5.0', 'the npm module prop-types'];
  // 15.6.0
  deprecated[`${pragma}.DOM`] = ['15.6.0', 'the npm module react-dom-factories'];
  // 16.9.0
  // For now the following life-cycle methods are just legacy, not deprecated:
  // `componentWillMount`, `componentWillReceiveProps`, `componentWillUpdate`
  // https://github.com/yannickcr/eslint-plugin-react/pull/1750#issuecomment-425975934
  deprecated.componentWillMount = [
    '16.9.0',
    'UNSAFE_componentWillMount',
    'https://reactjs.org/docs/react-component.html#unsafe_componentwillmount. '
    + 'Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
  ];
  deprecated.componentWillReceiveProps = [
    '16.9.0',
    'UNSAFE_componentWillReceiveProps',
    'https://reactjs.org/docs/react-component.html#unsafe_componentwillreceiveprops. '
    + 'Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
  ];
  deprecated.componentWillUpdate = [
    '16.9.0',
    'UNSAFE_componentWillUpdate',
    'https://reactjs.org/docs/react-component.html#unsafe_componentwillupdate. '
    + 'Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.',
  ];
  return deprecated;
}

const messages = {
  deprecated: '{{oldMethod}} is deprecated since React {{version}}{{newMethod}}{{refs}}',
};

module.exports = {
  meta: {
    docs: {
      description: 'Disallow usage of deprecated methods',
      category: 'Best Practices',
      recommended: true,
      url: docsUrl('no-deprecated'),
    },

    messages,

    schema: [],
  },

  create(context) {
    const pragma = pragmaUtil.getFromContext(context);
    const deprecated = getDeprecated(pragma);

    function isDeprecated(method) {
      return (
        deprecated
        && deprecated[method]
        && deprecated[method][0]
        && testReactVersion(context, `>= ${deprecated[method][0]}`)
      );
    }

    function checkDeprecation(node, methodName, methodNode) {
      if (!isDeprecated(methodName)) {
        return;
      }
      const version = deprecated[methodName][0];
      const newMethod = deprecated[methodName][1];
      const refs = deprecated[methodName][2];
      report(context, messages.deprecated, 'deprecated', {
        node: methodNode || node,
        data: {
          oldMethod: methodName,
          version,
          newMethod: newMethod ? `, use ${newMethod} instead` : '',
          refs: refs ? `, see ${refs}` : '',
        },
      });
    }

    function getReactModuleName(node) {
      let moduleName = false;
      if (!node.init) {
        return moduleName;
      }

      values(MODULES).some((moduleNames) => {
        moduleName = moduleNames.find((name) => name === node.init.name);
        return moduleName;
      });

      return moduleName;
    }

    /**
     * Returns life cycle methods if available
     * @param {ASTNode} node The AST node being checked.
     * @returns {Array} The array of methods.
     */
    function getLifeCycleMethods(node) {
      const properties = astUtil.getComponentProperties(node);
      return properties.map((property) => ({
        name: astUtil.getPropertyName(property),
        node: astUtil.getPropertyNameNode(property),
      }));
    }

    /**
     * Checks life cycle methods
     * @param {ASTNode} node The AST node being checked.
     */
    function checkLifeCycleMethods(node) {
      if (
        componentUtil.isES5Component(node, context)
     || componentUtil.isES6Component(node, context)
      ) {
        const methods = getLifeCycleMethods(node);
        methods.forEach((method) => checkDeprecation(node, method.name, method.node));
      }
    }

    // --------------------------------------------------------------------------
    // Public
    // --------------------------------------------------------------------------

    return {
      MemberExpression(node) {
        checkDeprecation(node, context.sourceCode.getText(node));
      },

      ImportDeclaration(node) {
        const isReactImport = typeof MODULES[node.source.value] !== 'undefined';
        if (!isReactImport) {
          return;
        }
        node.specifiers.filter(((s) => s.imported)).forEach((specifier) => {
          checkDeprecation(node, `${MODULES[node.source.value][0]}.${specifier.imported.name}`);
        });
      },

      VariableDeclarator(node) {
        const reactModuleName = getReactModuleName(node);
        const isRequire = node.init && node.init.callee && node.init.callee.name === 'require';
        const isReactRequire = node.init
          && node.init.arguments
          && node.init.arguments.length
          && typeof MODULES[node.init.arguments[0].value] !== 'undefined';
        const isDestructuring = node.id && node.id.type === 'ObjectPattern';

        if (
          !(isDestructuring && reactModuleName)
          && !(isDestructuring && isRequire && isReactRequire)
        ) {
          return;
        }
        node.id.properties.filter((p) => p.type !== 'RestElement' && p.key).forEach((property) => {
          checkDeprecation(node, `${reactModuleName || pragma}.${property.key.name}`);
        });
      },

      ClassDeclaration: checkLifeCycleMethods,
      ClassExpression: checkLifeCycleMethods,
      ObjectExpression: checkLifeCycleMethods,
    };
  },
};
