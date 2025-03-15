import avro from 'avro-js';
import * as schemas from '../schemas/AvroSchemas';

// Export the schemas for use in other files
export { schemas };

/**
 * Cache of compiled Avro schemas
 */
const schemaCache = new Map<string, avro.Type>();

/**
 * Get a compiled Avro schema by name
 * @param schemaName The name of the schema to get
 * @returns The compiled Avro schema
 */
export function getSchema(schemaName: keyof typeof schemas): avro.Type {
  if (!schemaCache.has(schemaName)) {
    const schema = schemas[schemaName];
    if (!schema) {
      throw new Error(`Schema ${schemaName} not found`);
    }
    schemaCache.set(schemaName, avro.parse(schema));
  }
  return schemaCache.get(schemaName)!;
}

/**
 * Encode data using an Avro schema
 * @param schemaName The name of the schema to use
 * @param data The data to encode
 * @returns The encoded data as a Buffer
 */
export function encode<T>(schemaName: keyof typeof schemas, data: T): Buffer {
  const schema = getSchema(schemaName);
  return schema.toBuffer(data);
}

/**
 * Decode data using an Avro schema
 * @param schemaName The name of the schema to use
 * @param buffer The buffer to decode
 * @returns The decoded data
 */
export function decode<T>(schemaName: keyof typeof schemas, buffer: Buffer): T {
  const schema = getSchema(schemaName);
  return schema.fromBuffer(buffer) as T;
}

/**
 * Validate data against an Avro schema
 * @param schemaName The name of the schema to use
 * @param data The data to validate
 * @returns True if the data is valid, false otherwise
 */
export function validate<T>(schemaName: keyof typeof schemas, data: T): boolean {
  const schema = getSchema(schemaName);
  return schema.isValid(data);
}

/**
 * Get validation errors for data against an Avro schema
 * @param schemaName The name of the schema to use
 * @param data The data to validate
 * @returns An array of validation errors, or an empty array if the data is valid
 */
export function getValidationErrors<T>(schemaName: keyof typeof schemas, data: T): string[] {
  const schema = getSchema(schemaName);
  const errors: string[] = [];
  
  schema.isValid(data, {
    errorHook: (path, value, type) => {
      errors.push(`Invalid value at ${path}: ${value} is not a valid ${type}`);
    }
  });
  
  return errors;
}

/**
 * Create a new instance of a schema with default values
 * @param schemaName The name of the schema to use
 * @returns A new instance of the schema with default values
 */
export function createInstance<T>(schemaName: keyof typeof schemas): T {
  const schema = getSchema(schemaName);
  return schema.createResolver().resolve(null) as T;
}

/**
 * Get the Avro schema as a JSON string
 * @param schemaName The name of the schema to get
 * @returns The schema as a JSON string
 */
export function getSchemaJson(schemaName: keyof typeof schemas): string {
  const schema = schemas[schemaName];
  return JSON.stringify(schema, null, 2);
}

/**
 * Get all available schema names
 * @returns An array of schema names
 */
export function getSchemaNames(): string[] {
  return Object.keys(schemas);
} 