import { ShapeShape } from './Shacl.typings';
import { ShaclSchema } from './Shacl.schema';
import { ShaclContext } from './Shacl.context';
import type { ShapeType } from '@ldo/ldo';
import type { Schema } from 'shexj';

/**
 * =============================================================================
 * LDO ShapeTypes for Shacl
 * =============================================================================
 */

/**
 * ShapeShape ShapeType
 */
export const ShapeShapeShapeType: ShapeType<ShapeShape> = {
  schema: ShaclSchema as Schema,
  shape: 'http://www.w3.org/ns/shacl-shacl#ShapeShape',
  context: ShaclContext as any,
};