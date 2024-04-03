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
  targetClass?: {
    "@id": string;
  }[];
  targetSubjectsOf?: {
    "@id": string;
  }[];
  targetObjectsOf?: {
    "@id": string;
  }[];
  severity?: {
    "@id": string;
  };
  deactivated?: string;
  class?: {
    "@id": string;
  }[];
  closed?: boolean;
  datatype?: {
    "@id": string;
  };
  disjoint?: {
    "@id": string;
  }[];
  equals?: {
    "@id": string;
  }[];
  lessThan?: {
    "@id": string;
  }[];
  lessThanOrEquals?: {
    "@id": string;
  }[];
  maxCount?: number;
  maxExclusive?: string;
  maxInclusive?: string;
  maxLength?: number;
  minCount?: number;
  minExclusive?: string;
  minInclusive?: string;
  minLength?: number;
  nodeKind?: {
    "@id": string;
  };
  pattern?: string;
  flags?: string;
  qualifiedMaxCount?: number;
  qualifiedMinCount?: number;
  qualifiedValueShapesDisjoint?: boolean;
  uniqueLang?: boolean;
}
