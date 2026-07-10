import { matchesAny } from "../shared/policy-utils.mjs";
import { getFilename } from "../shared/source-utils.mjs";

const patternList = { type: "array", items: { type: "string" } };

const schema = {
  type: "object",
  properties: {
    filePatterns: patternList,
    allowedVariableNames: patternList,
  },
  additionalProperties: false,
};

function toRegExps(patterns) {
  return (patterns ?? []).map((pattern) => new RegExp(pattern, "u"));
}

function isAllowedVariable(node, allowedNames) {
  if (node.type !== "VariableDeclaration" || node.kind !== "const") {
    return false;
  }

  return node.declarations.every(
    (declarator) =>
      declarator.id?.type === "Identifier" &&
      allowedNames.includes(declarator.id.name),
  );
}

function isInsideNamedTypeDeclaration(node) {
  let current = node.parent;
  while (current !== undefined && current.type !== "Program") {
    if (
      current.type === "TSInterfaceDeclaration" ||
      current.type === "TSTypeAliasDeclaration"
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Project architecture rule: implementation-layer files must contain only the
 * class or function that belongs to that layer. No module-level consts, enums,
 * interfaces, types, or helper functions. The only allowed exception is a
 * file-local `LOG_PREFIX` const (or names configured in `allowedVariableNames`).
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Implementation-layer files must not declare module-level constants, enums, interfaces, types, or helper functions.",
    },
    schema: [schema],
    messages: {
      noInlineConst:
        "Do not declare module-level const values in this file. Move them to a *.constants.ts module (only a file-local LOG_PREFIX is allowed).",
      noInlineEnum:
        "Do not declare enums in this file. Move them to a dedicated enums module.",
      noInlineInterface:
        "Do not declare interfaces in this file. Move them to a dedicated types/model module.",
      noInlineTypeAlias:
        "Do not declare type aliases in this file. Move them to a dedicated types/model module.",
      noInlineTypeLiteral:
        "Do not use an anonymous type literal in this implementation-layer file. Move the contract to its dedicated types/model module and import it.",
      noInlineFunction:
        "Do not declare helper functions in this file. Move them to a lib/*.helpers.ts or shared util module.",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const filePatterns = toRegExps(options.filePatterns ?? []);
    const allowedVariableNames = options.allowedVariableNames ?? ["LOG_PREFIX"];
    const filename = getFilename(context);

    if (filePatterns.length > 0 && !matchesAny(filename, filePatterns)) {
      return {};
    }

    return {
      "Program > VariableDeclaration"(node) {
        if (!isAllowedVariable(node, allowedVariableNames)) {
          context.report({ node, messageId: "noInlineConst" });
        }
      },
      "Program > TSEnumDeclaration"(node) {
        context.report({ node, messageId: "noInlineEnum" });
      },
      "Program > TSInterfaceDeclaration"(node) {
        context.report({ node, messageId: "noInlineInterface" });
      },
      "Program > TSTypeAliasDeclaration"(node) {
        context.report({ node, messageId: "noInlineTypeAlias" });
      },
      TSTypeLiteral(node) {
        if (!isInsideNamedTypeDeclaration(node)) {
          context.report({ node, messageId: "noInlineTypeLiteral" });
        }
      },
      "Program > FunctionDeclaration"(node) {
        context.report({ node, messageId: "noInlineFunction" });
      },
    };
  },
};
