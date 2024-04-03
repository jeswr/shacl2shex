import { ShapeType } from "@ldo/ldo";
import { ShaclSchema } from "./Shacl.schema";
import { ShaclContext } from "./Shacl.context";
import { ShapeShape } from "./Shacl.typings";

/**
 * =============================================================================
 * LDO ShapeTypes Shacl
 * =============================================================================
 */

/**
 * ShapeShape ShapeType
 */
export const ShapeShapeShapeType: ShapeType<ShapeShape> = {
  schema: ShaclSchema,
  shape: "http://www.w3.org/ns/shacl-shacl#ShapeShape",
  context: ShaclContext,
};
