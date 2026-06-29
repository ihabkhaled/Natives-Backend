const CONTROLLER_RETURN_NODE_TYPES = new Set([
  'CallExpression',
  'ChainExpression',
  'Identifier',
  'Literal',
  'MemberExpression',
]);

function isAllowedControllerReturnExpression(node) {
  if (!node) {
    return false;
  }

  if (node.type === 'AwaitExpression') {
    return isAllowedControllerReturnExpression(node.argument);
  }

  return CONTROLLER_RETURN_NODE_TYPES.has(node.type);
}

/**
 * Project architecture rule: controllers must stay HTTP-only and delegate.
 *
 * Standard ESLint rules can limit syntax, but they cannot clearly express
 * this "one direct controller delegation per method" convention. A controller
 * method must contain exactly one return statement whose value is a direct
 * delegation (`return this.useCase.execute(dto)`), an identifier, a member
 * access, or a literal. No branching, no transformation, no orchestration.
 *
 * Maintain this rule by broadening allowed return expression shapes only when
 * controller delegation patterns genuinely need them.
 */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Methods in the targeted files must delegate directly and contain only a single return statement.',
    },
    schema: [],
    messages: {
      singleReturnOnly:
        'Methods here must contain exactly one return statement and no extra logic.',
      invalidReturn:
        'Methods here may only return a direct delegation, identifier, member access, or literal.',
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        if (node.kind === 'constructor' || node.value.body === null) {
          return;
        }

        const statements = node.value.body.body;

        if (
          statements.length !== 1 ||
          statements[0].type !== 'ReturnStatement'
        ) {
          context.report({
            node,
            messageId: 'singleReturnOnly',
          });
          return;
        }

        if (!isAllowedControllerReturnExpression(statements[0].argument)) {
          context.report({
            node: statements[0],
            messageId: 'invalidReturn',
          });
        }
      },
    };
  },
};
