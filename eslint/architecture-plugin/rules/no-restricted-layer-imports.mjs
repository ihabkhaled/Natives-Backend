import {
  compileImportPolicies,
  compileRestrictedAccess,
  importPolicyMatches,
  matchesAny,
} from "../shared/policy-utils.mjs";
import {
  getFilename,
  getImportCandidates,
  getImportSource,
} from "../shared/source-utils.mjs";

const patternList = { type: "array", items: { type: "string" } };

const importPolicySchema = {
  type: "object",
  properties: {
    from: patternList,
    forbid: patternList,
    allowIn: patternList,
    message: { type: "string" },
  },
  required: ["forbid", "message"],
  additionalProperties: false,
};

const restrictedAccessSchema = {
  type: "object",
  properties: {
    object: { type: "string" },
    property: { type: "string" },
    allowIn: patternList,
    message: { type: "string" },
  },
  required: ["object", "property", "message"],
  additionalProperties: false,
};

function isLiteralProperty(node, propertyName) {
  return (
    node.property.type === "Literal" &&
    typeof node.property.value === "string" &&
    node.property.value === propertyName
  );
}

function isIdentifierProperty(node, propertyName) {
  return (
    node.property.type === "Identifier" && node.property.name === propertyName
  );
}

function isTargetMemberExpression(node, rule) {
  if (node.object.type !== "Identifier" || node.object.name !== rule.object) {
    return false;
  }

  return (
    isIdentifierProperty(node, rule.property) ||
    isLiteralProperty(node, rule.property)
  );
}

function extractAliasNames(declarator, objectName, propertyName) {
  const names = [];
  const init = declarator.init;

  // const { env } = process;
  if (
    init &&
    init.type === "Identifier" &&
    init.name === objectName &&
    declarator.id.type === "ObjectPattern"
  ) {
    for (const prop of declarator.id.properties) {
      if (
        prop.type === "Property" &&
        prop.key.type === "Identifier" &&
        prop.key.name === propertyName &&
        prop.value.type === "Identifier"
      ) {
        names.push(prop.value.name);
      }
    }
  }

  // const env = process.env;
  if (
    init &&
    init.type === "MemberExpression" &&
    init.object.type === "Identifier" &&
    init.object.name === objectName &&
    (isIdentifierProperty(init, propertyName) ||
      isLiteralProperty(init, propertyName)) &&
    declarator.id.type === "Identifier"
  ) {
    names.push(declarator.id.name);
  }

  return names;
}

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
    type: "problem",
    docs: {
      description:
        "Enforce configurable import boundaries and restricted runtime access between layers.",
    },
    schema: [
      {
        type: "object",
        properties: {
          policies: { type: "array", items: importPolicySchema },
          restrictedAccess: {
            type: "array",
            items: restrictedAccessSchema,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbiddenImport: '{{message}} Forbidden import: "{{importSource}}".',
      restrictedAccess: "{{message}}",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const policies = compileImportPolicies(options.policies);
    const restrictedAccess = compileRestrictedAccess(options.restrictedAccess);
    const filename = getFilename(context);
    const visitors = {};

    if (policies.length > 0) {
      visitors.ImportDeclaration = (node) => {
        const source = getImportSource(node);
        const candidates = getImportCandidates(source, filename);

        for (const policy of policies) {
          if (importPolicyMatches(policy, filename, candidates)) {
            context.report({
              node,
              messageId: "forbiddenImport",
              data: { importSource: source, message: policy.message },
            });
          }
        }
      };
    }

    if (restrictedAccess.length > 0) {
      // Track names bound to process.env so that later env.PORT usage is also caught.
      const envAliases = new Set();

      visitors.VariableDeclarator = (node) => {
        for (const rule of restrictedAccess) {
          if (matchesAny(filename, rule.allowIn)) {
            continue;
          }

          for (const alias of extractAliasNames(
            node,
            rule.object,
            rule.property,
          )) {
            envAliases.add(alias);
          }
        }
      };

      visitors.MemberExpression = (node) => {
        for (const rule of restrictedAccess) {
          if (matchesAny(filename, rule.allowIn)) {
            continue;
          }

          const isDirectAccess = isTargetMemberExpression(node, rule);
          const isAliasAccess =
            node.object.type === "Identifier" &&
            envAliases.has(node.object.name);

          if (isDirectAccess || isAliasAccess) {
            context.report({
              node,
              messageId: "restrictedAccess",
              data: { message: rule.message },
            });
          }
        }
      };
    }

    return visitors;
  },
};
