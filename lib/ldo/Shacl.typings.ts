import { ContextDefinition } from "jsonld";

/**
 * =============================================================================
 * Typescript Typings for Shacl
 * =============================================================================
 */

/**
 * ShapeShape Type
 */
export interface ShapeShape {
  "@id"?: string;
  "@context"?: ContextDefinition;
  closed?: boolean;
  maxCount?: number;
  maxLength?: number;
  minCount?: number;
  minLength?: number;
  pattern?: string;
  flags?: string;
  qualifiedMaxCount?: number;
  qualifiedMinCount?: number;
  qualifiedValueShapesDisjoint?: boolean;
  uniqueLang?: boolean;
}
