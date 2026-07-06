/**
 * Public API of @jeswr/shacl2shex.
 *
 * The conversion is a two-stage pipeline:
 *
 *   SHACL ingestion ({@link parseShaclSchema})
 *     → intermediate model (`ShaclSchema`, see ./model)
 *       → ShEx emission ({@link shexSchemaFromShacl})
 *
 * {@link shaclStoreToShexSchema} composes the two stages and is the primary
 * entry point; the individual stages are exported for advanced use.
 */
import type { Store } from 'n3';
import type { Schema } from 'shexj';
import { parseShaclSchema } from './parse';
import { shexSchemaFromShacl } from './toShex';

export { parseShaclSchema } from './parse';
export { shexSchemaFromShacl } from './toShex';
export { writeShexSchema } from './writeShex';
export { shapeMapFromDataset, writeShapeMap } from './shapeMap';
export type { ShapeMap, ShapeMapEntry } from './shapeMap';
export type {
  PropertyPath, ShaclNodeKind, ShaclNodeShape, ShaclProperty, ShaclSchema,
} from './model';

/** Converts the SHACL node shapes in `shapeStore` into a ShexJ schema. */
export async function shaclStoreToShexSchema(shapeStore: Store): Promise<Schema> {
  return shexSchemaFromShacl(parseShaclSchema(shapeStore));
}
