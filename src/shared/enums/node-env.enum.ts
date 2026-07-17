export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export const NODE_ENV_VALUES: readonly NodeEnv[] = Object.values(NodeEnv);
