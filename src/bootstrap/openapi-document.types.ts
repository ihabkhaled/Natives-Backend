import type { OpenAPIObject } from '@nestjs/swagger';

export type OpenApiDocument = OpenAPIObject;
export type OpenApiPathItem = OpenApiDocument['paths'][string];
export type OpenApiOperation = NonNullable<OpenApiPathItem['get']>;
