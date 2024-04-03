import { ContextDefinition } from "jsonld";

/**
 * =============================================================================
 * ShaclContext: JSONLD Context for Shacl
 * =============================================================================
 */
export const ShaclContext: ContextDefinition = {
  closed: {
    "@id": "http://www.w3.org/ns/shacl#closed",
    "@type": "http://www.w3.org/2001/XMLSchema#boolean",
  },
  maxCount: {
    "@id": "http://www.w3.org/ns/shacl#maxCount",
    "@type": "http://www.w3.org/2001/XMLSchema#integer",
  },
  maxLength: {
    "@id": "http://www.w3.org/ns/shacl#maxLength",
    "@type": "http://www.w3.org/2001/XMLSchema#integer",
  },
  minCount: {
    "@id": "http://www.w3.org/ns/shacl#minCount",
    "@type": "http://www.w3.org/2001/XMLSchema#integer",
  },
  minLength: {
    "@id": "http://www.w3.org/ns/shacl#minLength",
    "@type": "http://www.w3.org/2001/XMLSchema#integer",
  },
  pattern: {
    "@id": "http://www.w3.org/ns/shacl#pattern",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  flags: {
    "@id": "http://www.w3.org/ns/shacl#flags",
    "@type": "http://www.w3.org/2001/XMLSchema#string",
  },
  qualifiedMaxCount: {
    "@id": "http://www.w3.org/ns/shacl#qualifiedMaxCount",
    "@type": "http://www.w3.org/2001/XMLSchema#integer",
  },
  qualifiedMinCount: {
    "@id": "http://www.w3.org/ns/shacl#qualifiedMinCount",
    "@type": "http://www.w3.org/2001/XMLSchema#integer",
  },
  qualifiedValueShapesDisjoint: {
    "@id": "http://www.w3.org/ns/shacl#qualifiedValueShapesDisjoint",
    "@type": "http://www.w3.org/2001/XMLSchema#boolean",
  },
  uniqueLang: {
    "@id": "http://www.w3.org/ns/shacl#uniqueLang",
    "@type": "http://www.w3.org/2001/XMLSchema#boolean",
  },
};
