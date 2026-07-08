export interface IdGeneratorPort {
  generate(): string;
}

export const ID_GENERATOR_PORT = Symbol('ID_GENERATOR_PORT');
