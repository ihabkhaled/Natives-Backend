const CONTROLLER_RETURN_NODE_TYPES = new Set([
  "CallExpression",
  "ChainExpression",
  "Identifier",
  "Literal",
  "MemberExpression",
]);

function isAllowedControllerReturnExpression(node) {
  if (!node) {
    return false;
  }

  if (node.type === "AwaitExpression") {
    return isAllowedControllerReturnExpression(node.argument);
  }

  return CONTROLLER_RETURN_NODE_TYPES.has(node.type);
}

function isRouteHandler(methodNode) {
  // NestJS route handlers are methods or class-property arrows that carry at
  // least one decorator. Constructors, getters, setters, and private helpers
  // without decorators are intentionally skipped to avoid false positives.
  return (methodNode.decorators?.length ?? 0) > 0;
}

function isFunctionValue(node) {
  if (!node) {
    return false;
  }

  return (
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function checkSingleDelegation(context, node, body) {
  if (!body || body.type !== "BlockStatement") {
    return;
  }

  const statements = body.body;

  if (statements.length !== 1 || statements[0].type !== "ReturnStatement") {
    context.report({
      node,
      messageId: "singleReturnOnly",
    });
    return;
  }

  if (!isAllowedControllerReturnExpression(statements[0].argument)) {
    context.report({
      node: statements[0],
      messageId: "invalidReturn",
    });
  }
}

/**
 * Project architecture rule: controllers must stay HTTP-only and delegate.
 *
 * Standard ESLint rules can limit syntax, but they cannot clearly express
 * this "one direct controller delegation per method" convention. A controller
 * route handler must contain exactly one return statement whose value is a
 * direct delegation (`return this.useCase.execute(dto)`), an identifier, a
 * member access, or a literal. No branching, no transformation, no orchestration.
 *
 * Maintain this rule by broadening allowed return expression shapes only when
 * controller delegation patterns genuinely need them.
 */
export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Controller route handlers must delegate directly and contain only a single return statement.",
    },
    schema: [],
    messages: {
      singleReturnOnly:
        "Controller route handlers must contain exactly one return statement and no extra logic.",
      invalidReturn:
        "Controller route handlers may only return a direct delegation, identifier, member access, or literal.",
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        if (
          node.kind === "constructor" ||
          node.kind === "get" ||
          node.kind === "set"
        ) {
          return;
        }

        if (!isRouteHandler(node)) {
          return;
        }

        checkSingleDelegation(context, node, node.value.body);
      },
      PropertyDefinition(node) {
        // Class-property arrow functions can also be route handlers in NestJS.
        if (!isRouteHandler(node) || !isFunctionValue(node.value)) {
          return;
        }

        checkSingleDelegation(context, node, node.value.body);
      },
    };
  },
};
