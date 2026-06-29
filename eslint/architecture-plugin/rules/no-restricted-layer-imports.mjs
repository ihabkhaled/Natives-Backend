import {
  compileImportPolicies,
  compileRestrictedAccess,
  importPolicyMatches,
  matchesAny,
} from '../shared/policy-utils.mjs';
import {
  getFilename,
  getImportCandidates,
  getImportSource,
} from '../shared/source-utils.mjs';

const patternList = { type: 'array', items: { type: 'string' } };

const importPolicySchema = {
  type: 'object',
  properties: {
    from: patternList,
    forbid: patternList,
    allowIn: patternList,
    message: { type: 'string' },
  },
  required: ['forbid', 'message'],
  additionalProperties: false,
};

const restrictedAccessSchema = {
  type: 'object',
  properties: {
    object: { type: 'string' },
    property: { type: 'string' },
    allowIn: patternList,
    message: { type: 'string' },
  },
  required: ['object', 'property', 'message'],
  additionalProperties: false,
};

/**
 * Project architecture rule: enforce path-based layer and gateway boundaries.
 *
 * Standard import restrictions can handle many single-file cases, but this
 * rule keeps path resolution, allow-list exceptions, and runtime access checks
 * in one configurable policy shape. Maintain it by adding stable path/layer
 * regexes in eslint/architecture.config.mjs, not hardcoded entity names here.
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce configurable import boundaries and restricted runtime access between layers.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          policies: { type: 'array', items: importPolicySchema },
          restrictedAccess: {
            type: 'array',
            items: restrictedAccessSchema,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbiddenImport: '{{message}} Forbidden import: "{{importSource}}".',
      restrictedAccess: '{{message}}',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const policies = compileImportPolicies(options.policies);
    const restrictedAccess = compileRestrictedAccess(options.restrictedAccess);
    const filename = getFilename(context);
    const visitors = {};

    if (policies.length > 0) {
      visitors.ImportDeclaration = node => {
        const source = getImportSource(node);
        const candidates = getImportCandidates(source, filename);

        for (const policy of policies) {
          if (importPolicyMatches(policy, filename, candidates)) {
            context.report({
              node,
              messageId: 'forbiddenImport',
              data: { importSource: source, message: policy.message },
            });
          }
        }
      };
    }

    if (restrictedAccess.length > 0) {
      visitors.MemberExpression = node => {
        if (
          node.object.type !== 'Identifier' ||
          node.property.type !== 'Identifier'
        ) {
          return;
        }

        for (const rule of restrictedAccess) {
          if (
            node.object.name === rule.object &&
            node.property.name === rule.property &&
            !matchesAny(filename, rule.allowIn)
          ) {
            context.report({
              node,
              messageId: 'restrictedAccess',
              data: { message: rule.message },
            });
          }
        }
      };
    }

    return visitors;
  },
};
