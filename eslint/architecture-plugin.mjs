import controllerNoLogicRule from "./architecture-plugin/rules/controller-no-logic.mjs";
import noCrossModuleInternalImportsRule from "./architecture-plugin/rules/no-cross-module-internal-imports.mjs";
import noDtoImportInDomainOrUseCaseRule from "./architecture-plugin/rules/no-dto-import-in-domain-or-use-case.mjs";
import noInlineLayerDeclarationsRule from "./architecture-plugin/rules/no-inline-layer-declarations.mjs";
import noRestrictedLayerImportsRule from "./architecture-plugin/rules/no-restricted-layer-imports.mjs";
import noUseCaseImportInServiceRule from "./architecture-plugin/rules/no-use-case-import-in-service.mjs";

/**
 * Local architecture plugin registry.
 *
 * Keep this file small: add new custom rules as separate files under
 * eslint/architecture-plugin/rules and share only generic helpers from
 * eslint/architecture-plugin/shared.
 *
 * These rules encode the layered-architecture policy that off-the-shelf ESLint
 * rules cannot express cleanly:
 *   - controller-no-logic: controllers must stay HTTP-only and delegate.
 *   - no-restricted-layer-imports: path-based import boundaries + restricted
 *     runtime access (e.g. process.env only in config/bootstrap).
 *   - no-inline-layer-declarations: implementation files contain only the layer
 *     class/function; no module-level consts, enums, types, interfaces, or helpers.
 *   - no-dto-import-in-domain-or-use-case: domain and use-case logic depends on
 *     model types, not API request/response DTOs.
 *   - no-use-case-import-in-service: dependency direction is one-way; use cases
 *     call services, never the reverse.
 *   - no-cross-module-internal-imports: private implementation layers of one
 *     module cannot be imported directly from another module.
 */
export default {
  rules: {
    "controller-no-logic": controllerNoLogicRule,
    "no-cross-module-internal-imports": noCrossModuleInternalImportsRule,
    "no-dto-import-in-domain-or-use-case": noDtoImportInDomainOrUseCaseRule,
    "no-inline-layer-declarations": noInlineLayerDeclarationsRule,
    "no-restricted-layer-imports": noRestrictedLayerImportsRule,
    "no-use-case-import-in-service": noUseCaseImportInServiceRule,
  },
};
