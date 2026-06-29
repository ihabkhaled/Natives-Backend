import controllerNoLogicRule from './architecture-plugin/rules/controller-no-logic.mjs';
import noRestrictedLayerImportsRule from './architecture-plugin/rules/no-restricted-layer-imports.mjs';

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
 */
export default {
  rules: {
    'controller-no-logic': controllerNoLogicRule,
    'no-restricted-layer-imports': noRestrictedLayerImportsRule,
  },
};
