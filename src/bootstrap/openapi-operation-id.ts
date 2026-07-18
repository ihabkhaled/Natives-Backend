const CONTROLLER_SUFFIX = /Controller$/u;

export function createOpenApiOperationId(
  controllerKey: string,
  methodKey: string,
): string {
  const resource = controllerKey.replace(CONTROLLER_SUFFIX, '');
  return `${resource}.${methodKey}`;
}
