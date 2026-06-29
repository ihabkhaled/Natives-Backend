import securityPlugin from 'eslint-plugin-security';

export default {
  files: ['**/*.ts'],
  plugins: {
    security: securityPlugin,
  },
  rules: {
    // Enable the plugin's recommended risky JavaScript pattern checks.
    ...securityPlugin.configs.recommended.rules,
    // Flag dynamic object access that can hide injection risks.
    'security/detect-object-injection': 'error',
  },
};
