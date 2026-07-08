import { getFilename, getImportCandidates } from "../shared/source-utils.mjs";

const patternList = { type: "array", items: { type: "string" } };

const schema = {
  type: "object",
  properties: {
    modulePattern: { type: "string" },
    privateLayers: patternList,
    publicLayerPatterns: patternList,
    message: { type: "string" },
  },
  additionalProperties: false,
};

function compileRegex(pattern, defaultPattern) {
  const effectivePattern =
    typeof pattern === "string" && pattern.length > 0
      ? pattern
      : defaultPattern;

  return new RegExp(effectivePattern);
}

function extractModuleName(filename, regex) {
  const match = regex.exec(filename);
  return match?.[1] ?? "";
}

function isPrivateCrossModuleImport(filename, candidates, options) {
  const modulePattern = compileRegex(
    options.modulePattern,
    "src/modules/([^/]+)/",
  );
  const currentModule = extractModuleName(filename, modulePattern);

  if (!currentModule) {
    return false;
  }

  const privateLayers = options.privateLayers ?? [
    "api",
    "application",
    "domain",
    "infrastructure",
  ];
  const publicLayerPatterns = options.publicLayerPatterns ?? [];
  const privateLayerPattern = new RegExp(`/(${privateLayers.join("|")})/`);

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const targetModule = extractModuleName(candidate, modulePattern);

    if (!targetModule || targetModule === currentModule) {
      continue;
    }

    if (
      publicLayerPatterns.some((pattern) => new RegExp(pattern).test(candidate))
    ) {
      continue;
    }

    if (privateLayerPattern.test(candidate)) {
      return true;
    }
  }

  return false;
}

/**
 * Project architecture rule: forbid direct imports into another module's
 * implementation layers.
 *
 * Modules expose their contracts through the `model/` layer (types, enums,
 * constants) and through public index/public barrels. Importing another
 * module's controller, service, use-case, repository, or domain file directly
 * breaks ownership boundaries and makes refactors risky. This rule keeps the
 * boundary explicit and mechanically enforceable.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct imports into private layers of another module.",
    },
    schema: [schema],
    messages: {
      crossModuleInternalImport:
        "Importing private implementation files from another module is forbidden. Use the owning module's public or model entrypoint instead.",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const filename = getFilename(context);

    return {
      ImportDeclaration(node) {
        const candidates = getImportCandidates(node.source.value, filename);

        if (isPrivateCrossModuleImport(filename, candidates, options)) {
          context.report({
            node,
            messageId: "crossModuleInternalImport",
          });
        }
      },
    };
  },
};
