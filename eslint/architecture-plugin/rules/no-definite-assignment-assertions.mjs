/**
 * Definite-assignment assertions (`field!: Type`) bypass strict property
 * initialization just like non-null assertions bypass null safety. Framework
 * populated declarations use `declare`, while stateful classes initialize
 * fields in their constructor.
 */
export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow TypeScript definite-assignment assertions on class fields.",
    },
    schema: [],
    messages: {
      noDefiniteAssignment:
        "Do not use a definite-assignment assertion. Use `declare` for framework-populated DTO fields or initialize the field in the constructor.",
    },
  },
  create(context) {
    return {
      PropertyDefinition(node) {
        if (node.definite === true) {
          context.report({ node, messageId: "noDefiniteAssignment" });
        }
      },
    };
  },
};
