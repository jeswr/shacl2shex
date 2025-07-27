/**
 * SHACL to ShEx Mapping Documentation
 * 
 * This file documents the complete mapping between SHACL and ShEx constructs
 * Based on:
 * - SHACL 1.1: https://www.w3.org/TR/shacl/
 * - ShEx 2.1: http://shex.io/shex-semantics/
 */

export interface MappingRule {
  shaclConstruct: string;
  shexConstruct: string;
  shaclSpec: string;
  shexSpec: string;
  notes?: string;
}

export const SHACL_TO_SHEX_MAPPINGS: MappingRule[] = [
  // Node Shapes
  {
    shaclConstruct: "sh:NodeShape",
    shexConstruct: "Shape Expression",
    shaclSpec: "https://www.w3.org/TR/shacl/#node-shapes",
    shexSpec: "http://shex.io/shex-semantics/#shape-expressions",
    notes: "SHACL NodeShape maps to ShEx Shape Expression"
  },
  
  // Property Shapes
  {
    shaclConstruct: "sh:PropertyShape",
    shexConstruct: "Triple Expression",
    shaclSpec: "https://www.w3.org/TR/shacl/#property-shapes",
    shexSpec: "http://shex.io/shex-semantics/#triple-expressions",
    notes: "SHACL PropertyShape maps to ShEx Triple Expression with predicate"
  },
  
  // Cardinality Constraints
  {
    shaclConstruct: "sh:minCount",
    shexConstruct: "min cardinality",
    shaclSpec: "https://www.w3.org/TR/shacl/#MinCountConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#cardinality",
    notes: "sh:minCount N maps to {N,}"
  },
  {
    shaclConstruct: "sh:maxCount",
    shexConstruct: "max cardinality",
    shaclSpec: "https://www.w3.org/TR/shacl/#MaxCountConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#cardinality",
    notes: "sh:maxCount N maps to {,N}"
  },
  
  // Value Type Constraints
  {
    shaclConstruct: "sh:datatype",
    shexConstruct: "datatype",
    shaclSpec: "https://www.w3.org/TR/shacl/#DatatypeConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "Direct mapping for datatype constraints"
  },
  {
    shaclConstruct: "sh:nodeKind sh:IRI",
    shexConstruct: "IRI",
    shaclSpec: "https://www.w3.org/TR/shacl/#NodeKindConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "sh:nodeKind sh:IRI maps to IRI constraint"
  },
  {
    shaclConstruct: "sh:nodeKind sh:BlankNode",
    shexConstruct: "BNODE",
    shaclSpec: "https://www.w3.org/TR/shacl/#NodeKindConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "sh:nodeKind sh:BlankNode maps to BNODE constraint"
  },
  {
    shaclConstruct: "sh:nodeKind sh:Literal",
    shexConstruct: "LITERAL",
    shaclSpec: "https://www.w3.org/TR/shacl/#NodeKindConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "sh:nodeKind sh:Literal maps to LITERAL constraint"
  },
  
  // String Constraints
  {
    shaclConstruct: "sh:pattern",
    shexConstruct: "pattern",
    shaclSpec: "https://www.w3.org/TR/shacl/#PatternConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "Regular expression patterns map directly"
  },
  {
    shaclConstruct: "sh:minLength",
    shexConstruct: "MINLENGTH",
    shaclSpec: "https://www.w3.org/TR/shacl/#MinLengthConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "String length constraints"
  },
  {
    shaclConstruct: "sh:maxLength",
    shexConstruct: "MAXLENGTH",
    shaclSpec: "https://www.w3.org/TR/shacl/#MaxLengthConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "String length constraints"
  },
  
  // Numeric Constraints
  {
    shaclConstruct: "sh:minInclusive",
    shexConstruct: "MININCLUSIVE",
    shaclSpec: "https://www.w3.org/TR/shacl/#MinInclusiveConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "Inclusive minimum value"
  },
  {
    shaclConstruct: "sh:maxInclusive",
    shexConstruct: "MAXINCLUSIVE",
    shaclSpec: "https://www.w3.org/TR/shacl/#MaxInclusiveConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "Inclusive maximum value"
  },
  {
    shaclConstruct: "sh:minExclusive",
    shexConstruct: "MINEXCLUSIVE",
    shaclSpec: "https://www.w3.org/TR/shacl/#MinExclusiveConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "Exclusive minimum value"
  },
  {
    shaclConstruct: "sh:maxExclusive",
    shexConstruct: "MAXEXCLUSIVE",
    shaclSpec: "https://www.w3.org/TR/shacl/#MaxExclusiveConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "Exclusive maximum value"
  },
  
  // Value Constraints
  {
    shaclConstruct: "sh:in",
    shexConstruct: "value set",
    shaclSpec: "https://www.w3.org/TR/shacl/#InConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "sh:in list maps to [value1 value2 ...]"
  },
  {
    shaclConstruct: "sh:hasValue",
    shexConstruct: "value",
    shaclSpec: "https://www.w3.org/TR/shacl/#HasValueConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "sh:hasValue maps to single value constraint"
  },
  
  // Logical Constraints
  {
    shaclConstruct: "sh:and",
    shexConstruct: "AND",
    shaclSpec: "https://www.w3.org/TR/shacl/#AndConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#prod-shapeAnd",
    notes: "Conjunction of shapes"
  },
  {
    shaclConstruct: "sh:or",
    shexConstruct: "OR",
    shaclSpec: "https://www.w3.org/TR/shacl/#OrConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#prod-shapeOr",
    notes: "Disjunction of shapes"
  },
  {
    shaclConstruct: "sh:not",
    shexConstruct: "NOT",
    shaclSpec: "https://www.w3.org/TR/shacl/#NotConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#prod-shapeNot",
    notes: "Negation of shapes"
  },
  
  // Shape References
  {
    shaclConstruct: "sh:node",
    shexConstruct: "@<shape>",
    shaclSpec: "https://www.w3.org/TR/shacl/#NodeConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#shape-references",
    notes: "Reference to another shape"
  },
  
  // Closed Shapes
  {
    shaclConstruct: "sh:closed",
    shexConstruct: "CLOSED",
    shaclSpec: "https://www.w3.org/TR/shacl/#ClosedConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#closed-expressions",
    notes: "Closed shape with sh:ignoredProperties mapping to EXTRA"
  },
  
  // Language Constraints
  {
    shaclConstruct: "sh:languageIn",
    shexConstruct: "language tag set",
    shaclSpec: "https://www.w3.org/TR/shacl/#LanguageInConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#nodeconstraints",
    notes: "Language tag constraints"
  },
  
  // Unique Language
  {
    shaclConstruct: "sh:uniqueLang",
    shexConstruct: "UNIQUE",
    shaclSpec: "https://www.w3.org/TR/shacl/#UniqueLangConstraintComponent",
    shexSpec: "http://shex.io/shex-semantics/#unique",
    notes: "Unique language constraint"
  }
];

/**
 * Get mapping for a SHACL construct
 */
export function getMappingForShaclConstruct(construct: string): MappingRule | undefined {
  return SHACL_TO_SHEX_MAPPINGS.find(m => m.shaclConstruct === construct);
}

/**
 * Get all mappings for a category
 */
export function getMappingsByCategory(category: string): MappingRule[] {
  // Categories could be: cardinality, value-type, string, numeric, logical, etc.
  const categoryMappings: { [key: string]: string[] } = {
    cardinality: ["sh:minCount", "sh:maxCount"],
    valueType: ["sh:datatype", "sh:nodeKind sh:IRI", "sh:nodeKind sh:BlankNode", "sh:nodeKind sh:Literal"],
    string: ["sh:pattern", "sh:minLength", "sh:maxLength"],
    numeric: ["sh:minInclusive", "sh:maxInclusive", "sh:minExclusive", "sh:maxExclusive"],
    logical: ["sh:and", "sh:or", "sh:not"],
    value: ["sh:in", "sh:hasValue"],
    shape: ["sh:node", "sh:closed"],
    language: ["sh:languageIn", "sh:uniqueLang"]
  };
  
  const constructs = categoryMappings[category] || [];
  return SHACL_TO_SHEX_MAPPINGS.filter(m => constructs.includes(m.shaclConstruct));
}