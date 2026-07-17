import regexpPlugin from "eslint-plugin-regexp";

export default {
  files: ["**/*.ts"],
  plugins: {
    regexp: regexpPlugin,
  },
  rules: {
    // Avoid duplicate character alternatives in character classes.
    "regexp/no-dupe-characters-character-class": "error",
    // Avoid empty alternatives that make regexes ambiguous.
    "regexp/no-empty-alternative": "error",
    // Avoid capturing groups that can never capture content.
    "regexp/no-empty-capturing-group": "error",
    // Avoid character classes that can never match.
    "regexp/no-empty-character-class": "error",
    // Avoid lazy quantifiers that do not affect matching.
    "regexp/no-lazy-ends": "error",
    // Catch regexes with unsafe backtracking behavior.
    "regexp/no-super-linear-backtracking": "error",
    // Remove assertions that do not change matching.
    "regexp/no-useless-assertions": "error",
    // Remove backreferences that cannot match useful content.
    "regexp/no-useless-backreference": "error",
    // Avoid dollar replacements that do nothing.
    "regexp/no-useless-dollar-replacements": "error",
    // Prefer clearer quantifier combinations.
    "regexp/optimal-quantifier-concatenation": "error",
    // Prefer \d for digit classes.
    "regexp/prefer-d": "error",
    // Prefer plus quantifiers where one-or-more is intended.
    "regexp/prefer-plus-quantifier": "error",
  },
};
