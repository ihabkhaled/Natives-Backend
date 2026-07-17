import { matchesAny } from "../shared/policy-utils.mjs";
import { getFilename, getImportSource } from "../shared/source-utils.mjs";

const patternList = { type: "array", items: { type: "string" } };

const schema = {
  type: "object",
  properties: {
    filePatterns: patternList,
    useCasePathPatterns: patternList,
  },
  additionalProperties: false,
};

function toRegExps(patterns) {
  return (patterns ?? []).map((pattern) => new RegExp(pattern, "u"));
}

/**
 * Project architecture rule: services must not import use cases. Dependency
 * direction is one-way: use cases call services, never the reverse. Importing a
 * use case from a service creates cycles and hides the transaction owner.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Services must not import use cases; use cases call services, not the reverse.",
    },
    schema: [schema],
    messages: {
      noUseCaseImportInService:
        "Services must not import use cases. Escalate to a use case or extract a shared service instead.",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const filePatterns = toRegExps(
      options.filePatterns ?? ["\\.service(?:\\.ts)?$"],
    );
    const useCasePathPatterns = toRegExps(
      options.useCasePathPatterns ?? [
        "\\.use-case(?:\\.ts)?$",
        "/application/.*\\.use-case(?:\\.ts)?$",
      ],
    );
    const filename = getFilename(context);

    if (!matchesAny(filename, filePatterns)) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const source = getImportSource(node);

        if (matchesAny(source, useCasePathPatterns)) {
          context.report({
            node,
            messageId: "noUseCaseImportInService",
            data: { source },
          });
        }
      },
    };
  },
};
