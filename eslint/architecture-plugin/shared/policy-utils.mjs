function toRegExps(patterns) {
  return (patterns ?? []).map((pattern) => new RegExp(pattern, "u"));
}

export function matchesAny(value, regexps) {
  return regexps.some((regexp) => regexp.test(value));
}

export function compileImportPolicies(policies) {
  return (policies ?? []).map((policy) => ({
    from: toRegExps(policy.from),
    forbid: toRegExps(policy.forbid),
    allowIn: toRegExps(policy.allowIn),
    message: policy.message,
  }));
}

export function compileRestrictedAccess(rules) {
  return (rules ?? []).map((rule) => ({
    object: rule.object,
    property: rule.property,
    allowIn: toRegExps(rule.allowIn),
    message: rule.message,
  }));
}

export function importPolicyMatches(policy, filename, candidates) {
  if (policy.from.length > 0 && !matchesAny(filename, policy.from)) {
    return false;
  }

  if (policy.allowIn.length > 0 && matchesAny(filename, policy.allowIn)) {
    return false;
  }

  return candidates.some((candidate) => matchesAny(candidate, policy.forbid));
}
