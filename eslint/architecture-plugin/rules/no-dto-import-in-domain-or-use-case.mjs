import { matchesAny } from "../shared/policy-utils.mjs";
import { getFilename, getImportSource } from "../shared/source-utils.mjs";

const patternList = { type: "array", items: { type: "string" } };

const schema = {
  type: "object",
  properties: {
    filePatterns: patternList,
    dtoPathPatterns: patternList,
  },
  additionalProperties: false,
};

function toRegExps(patterns) {
  return (patterns ?? []).map((pattern) => new RegExp(pattern, "u"));
}

/**
 * Project architecture rule: domain and use-case files must not import API DTOs.
 * Domain logic depends on the entity/model types in `model/` and `@shared`, not
 * on the HTTP-boundary request/response shapes in `api/dto/`.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Domain and use-case files must not import API DTOs from the api/dto layer.",
    },
    schema: [schema],
    messages: {
      noDtoImport:
        "Domain and use-case files must not import API DTOs. Use model types from model/*.types.ts or @shared/types instead.",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const filePatterns = toRegExps(
      options.filePatterns ?? [
        "/domain/",
        "\\.use-case(?:\\.ts)?$",
        "\\.policy(?:\\.ts)?$",
        "\\.entity(?:\\.ts)?$",
        "\\.state-machine(?:\\.ts)?$",
      ],
    );
    const dtoPathPatterns = toRegExps(
      options.dtoPathPatterns ?? ["/api/dto(?:/|$)", "\\/dto\\/"],
    );
    const filename = getFilename(context);

    if (!matchesAny(filename, filePatterns)) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const source = getImportSource(node);

        if (matchesAny(source, dtoPathPatterns)) {
          context.report({
            node,
            messageId: "noDtoImport",
            data: { source },
          });
        }
      },
    };
  },
};
