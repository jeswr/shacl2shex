/**
 * Complex real-world examples of SHACL to ShEx conversion
 */

import { describe, it, expect } from '@jest/globals';
import { convert, Result } from '../../lib/converters/shacl-to-shex-converter';
import * as SHACL from '../../lib/types/shacl-types';
import * as ShEx from '../../lib/types/shex-types';

describe('Complex Real-World SHACL to ShEx Examples', () => {
  
  describe('FOAF Person Shape', () => {
    it('should convert a FOAF-style person shape', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        prefixes: [
          { prefix: "foaf", namespace: "http://xmlns.com/foaf/0.1/" },
          { prefix: "xsd", namespace: "http://www.w3.org/2001/XMLSchema#" },
          { prefix: "ex", namespace: "http://example.org/" }
        ],
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:PersonShape",
          targetClass: ["foaf:Person"],
          nodeKind: SHACL.NodeKind.IRI,
          property: [
            {
              type: "sh:PropertyShape",
              path: "foaf:name",
              datatype: "xsd:string",
              minCount: 1,
              name: ["Full name"],
              description: ["The person's full name"]
            },
            {
              type: "sh:PropertyShape",
              path: "foaf:firstName",
              datatype: "xsd:string",
              maxCount: 1
            },
            {
              type: "sh:PropertyShape",
              path: "foaf:lastName",
              datatype: "xsd:string",
              maxCount: 1
            },
            {
              type: "sh:PropertyShape",
              path: "foaf:age",
              datatype: "xsd:integer",
              minInclusive: 0,
              maxInclusive: 150,
              maxCount: 1
            },
            {
              type: "sh:PropertyShape",
              path: "foaf:mbox",
              nodeKind: SHACL.NodeKind.IRI,
              pattern: "^mailto:",
              description: ["Email address as mailto: URI"]
            },
            {
              type: "sh:PropertyShape",
              path: "foaf:knows",
              node: ["ex:PersonShape"],
              description: ["Other people this person knows"]
            },
            {
              type: "sh:PropertyShape",
              path: "foaf:homepage",
              nodeKind: SHACL.NodeKind.IRI,
              pattern: "^https?://",
              maxCount: 1
            }
          ]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const schema = result.value;
        expect(schema.prefixes!["foaf"]).toBe("http://xmlns.com/foaf/0.1/");
        
        const personShape = schema.shapes![0];
        expect(personShape.id).toBe("ex:PersonShape");
        
        // Should be a ShapeAnd combining nodeKind and properties
        const shapeExpr = personShape.shapeExpr as ShEx.ShapeAnd;
        expect(shapeExpr.type).toBe("ShapeAnd");
        
        // Find the Shape with properties
        const propertyShape = shapeExpr.shapeExprs.find(
          expr => (expr as any).type === "Shape"
        ) as ShEx.Shape;
        
        const eachOf = propertyShape.expression as ShEx.EachOf;
        expect(eachOf.expressions).toHaveLength(7);
      }
    });
  });
  
  describe('Schema.org Product Shape', () => {
    it('should convert a Schema.org-style product shape', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        prefixes: [
          { prefix: "schema", namespace: "http://schema.org/" },
          { prefix: "xsd", namespace: "http://www.w3.org/2001/XMLSchema#" },
          { prefix: "ex", namespace: "http://example.org/" }
        ],
        shapes: [
          {
            type: "sh:NodeShape",
            id: "ex:ProductShape",
            targetClass: ["schema:Product"],
            closed: true,
            ignoredProperties: ["rdf:type"],
            property: [
              {
                type: "sh:PropertyShape",
                path: "schema:name",
                datatype: "xsd:string",
                minCount: 1,
                maxCount: 1,
                minLength: 1,
                maxLength: 200
              },
              {
                type: "sh:PropertyShape",
                path: "schema:description",
                datatype: "xsd:string",
                maxCount: 1,
                maxLength: 2000
              },
              {
                type: "sh:PropertyShape",
                path: "schema:brand",
                or: [
                  {
                    type: "sh:NodeShape",
                    node: ["ex:BrandShape"]
                  },
                  {
                    type: "sh:NodeShape",
                    datatype: "xsd:string"
                  }
                ],
                maxCount: 1
              },
              {
                type: "sh:PropertyShape",
                path: "schema:offers",
                node: ["ex:OfferShape"],
                minCount: 1
              },
              {
                type: "sh:PropertyShape",
                path: "schema:category",
                in: ["Electronics", "Clothing", "Food", "Books", "Other"],
                minCount: 1,
                maxCount: 3
              }
            ]
          },
          {
            type: "sh:NodeShape",
            id: "ex:BrandShape",
            targetClass: ["schema:Brand"],
            property: [{
              type: "sh:PropertyShape",
              path: "schema:name",
              datatype: "xsd:string",
              minCount: 1,
              maxCount: 1
            }]
          },
          {
            type: "sh:NodeShape",
            id: "ex:OfferShape",
            targetClass: ["schema:Offer"],
            property: [
              {
                type: "sh:PropertyShape",
                path: "schema:price",
                datatype: "xsd:decimal",
                minInclusive: 0,
                minCount: 1,
                maxCount: 1
              },
              {
                type: "sh:PropertyShape",
                path: "schema:priceCurrency",
                pattern: "^[A-Z]{3}$",
                minCount: 1,
                maxCount: 1,
                description: ["Three-letter currency code"]
              },
              {
                type: "sh:PropertyShape",
                path: "schema:availability",
                in: [
                  "http://schema.org/InStock",
                  "http://schema.org/OutOfStock",
                  "http://schema.org/PreOrder"
                ],
                minCount: 1,
                maxCount: 1
              }
            ]
          }
        ]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const schema = result.value;
        expect(schema.shapes).toHaveLength(3);
        
        // Check ProductShape
        const productShape = schema.shapes!.find(s => s.id === "ex:ProductShape");
        expect(productShape).toBeDefined();
        
        const shapeExpr = productShape!.shapeExpr as ShEx.Shape;
        expect(shapeExpr.closed).toBe(true);
        expect(shapeExpr.extra).toEqual(["rdf:type"]);
      }
    });
  });
  
  describe('DCAT Dataset Shape', () => {
    it('should convert a DCAT dataset shape with complex constraints', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        prefixes: [
          { prefix: "dcat", namespace: "http://www.w3.org/ns/dcat#" },
          { prefix: "dct", namespace: "http://purl.org/dc/terms/" },
          { prefix: "xsd", namespace: "http://www.w3.org/2001/XMLSchema#" },
          { prefix: "ex", namespace: "http://example.org/" }
        ],
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:DatasetShape",
          targetClass: ["dcat:Dataset"],
          property: [
            {
              type: "sh:PropertyShape",
              path: "dct:title",
              datatype: "xsd:string",
              minCount: 1,
              uniqueLang: true,
              description: ["Dataset title with unique language tags"]
            },
            {
              type: "sh:PropertyShape",
              path: "dct:description",
              datatype: "xsd:string",
              minCount: 1,
              languageIn: ["en", "es", "fr", "de"],
              description: ["Description in supported languages"]
            },
            {
              type: "sh:PropertyShape",
              path: "dct:issued",
              datatype: "xsd:date",
              maxCount: 1,
              lessThanOrEquals: ["dct:modified"]
            },
            {
              type: "sh:PropertyShape",
              path: "dct:modified",
              datatype: "xsd:date",
              maxCount: 1
            },
            {
              type: "sh:PropertyShape",
              path: "dcat:theme",
              nodeKind: SHACL.NodeKind.IRI,
              pattern: "^http://publications.europa.eu/resource/authority/data-theme/",
              minCount: 1,
              description: ["EU data theme vocabulary"]
            },
            {
              type: "sh:PropertyShape",
              path: "dcat:distribution",
              node: ["ex:DistributionShape"],
              minCount: 1
            }
          ]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const schema = result.value;
        const shape = schema.shapes![0].shapeExpr as ShEx.Shape;
        const eachOf = shape.expression as ShEx.EachOf;
        
        // Check for uniqueLang annotation
        const titleConstraint = eachOf.expressions.find(
          expr => (expr as any).predicate === "dct:title"
        ) as ShEx.TripleConstraint;
        
        expect(titleConstraint.annotations).toBeDefined();
        expect(titleConstraint.annotations!.some(
          ann => ann.predicate === "http://www.w3.org/ns/shacl#uniqueLang"
        )).toBe(true);
        
        // Check for property pair constraint semantic action
        const issuedConstraint = eachOf.expressions.find(
          expr => (expr as any).predicate === "dct:issued"
        ) as ShEx.TripleConstraint;
        
        expect(issuedConstraint.semActs).toBeDefined();
        expect(issuedConstraint.semActs!.some(
          act => act.name === "http://www.w3.org/ns/shacl#lessThanOrEquals"
        )).toBe(true);
      }
    });
  });
  
  describe('Recursive Organization Structure', () => {
    it('should convert a recursive organization hierarchy shape', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        prefixes: [
          { prefix: "org", namespace: "http://www.w3.org/ns/org#" },
          { prefix: "foaf", namespace: "http://xmlns.com/foaf/0.1/" },
          { prefix: "xsd", namespace: "http://www.w3.org/2001/XMLSchema#" },
          { prefix: "ex", namespace: "http://example.org/" }
        ],
        shapes: [
          {
            type: "sh:NodeShape",
            id: "ex:OrganizationShape",
            targetClass: ["org:Organization"],
            property: [
              {
                type: "sh:PropertyShape",
                path: "foaf:name",
                datatype: "xsd:string",
                minCount: 1,
                maxCount: 1
              },
              {
                type: "sh:PropertyShape",
                path: "org:identifier",
                datatype: "xsd:string",
                pattern: "^[A-Z]{2}[0-9]{8}$",
                minCount: 1,
                maxCount: 1,
                description: ["Organization identifier format: 2 letters + 8 digits"]
              },
              {
                type: "sh:PropertyShape",
                path: "org:subOrganizationOf",
                node: ["ex:OrganizationShape"],
                maxCount: 1,
                description: ["Parent organization (recursive)"]
              },
              {
                type: "sh:PropertyShape",
                path: "org:hasSubOrganization",
                node: ["ex:OrganizationShape"],
                description: ["Child organizations (recursive)"]
              },
              {
                type: "sh:PropertyShape",
                path: "org:hasMember",
                node: ["ex:PersonShape"],
                minCount: 1
              }
            ]
          },
          {
            type: "sh:NodeShape",
            id: "ex:PersonShape",
            targetClass: ["foaf:Person"],
            property: [
              {
                type: "sh:PropertyShape",
                path: "foaf:name",
                datatype: "xsd:string",
                minCount: 1,
                maxCount: 1
              },
              {
                type: "sh:PropertyShape",
                path: "org:memberOf",
                node: ["ex:OrganizationShape"],
                minCount: 1
              }
            ]
          }
        ]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const schema = result.value;
        expect(schema.shapes).toHaveLength(2);
        
        // Check for recursive references
        const orgShape = schema.shapes!.find(s => s.id === "ex:OrganizationShape");
        const shapeExpr = orgShape!.shapeExpr as ShEx.Shape;
        const eachOf = shapeExpr.expression as ShEx.EachOf;
        
        // Find recursive constraints
        const subOrgConstraint = eachOf.expressions.find(
          expr => (expr as any).predicate === "org:subOrganizationOf"
        ) as ShEx.TripleConstraint;
        
        expect(subOrgConstraint.valueExpr).toEqual({
          type: "ShapeRef",
          reference: "ex:OrganizationShape"
        });
        
        const hasSubOrgConstraint = eachOf.expressions.find(
          expr => (expr as any).predicate === "org:hasSubOrganization"
        ) as ShEx.TripleConstraint;
        
        expect(hasSubOrgConstraint.valueExpr).toEqual({
          type: "ShapeRef",
          reference: "ex:OrganizationShape"
        });
      }
    });
  });
  
  describe('Complex Validation with Multiple Constraint Types', () => {
    it('should convert a shape combining multiple advanced constraints', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        prefixes: [
          { prefix: "ex", namespace: "http://example.org/" },
          { prefix: "xsd", namespace: "http://www.w3.org/2001/XMLSchema#" }
        ],
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:ComplexShape",
          and: [
            {
              type: "sh:NodeShape",
              nodeKind: SHACL.NodeKind.IRI
            },
            {
              type: "sh:NodeShape",
              property: [{
                type: "sh:PropertyShape",
                path: "ex:status",
                xone: [
                  {
                    type: "sh:NodeShape",
                    hasValue: ["ex:Active"]
                  },
                  {
                    type: "sh:NodeShape",
                    hasValue: ["ex:Inactive"]
                  },
                  {
                    type: "sh:NodeShape",
                    hasValue: ["ex:Pending"]
                  }
                ]
              }]
            }
          ],
          property: [
            {
              type: "sh:PropertyShape",
              path: "ex:code",
              pattern: "^[A-Z]{3}-[0-9]{4}$",
              minCount: 1,
              maxCount: 1
            },
            {
              type: "sh:PropertyShape",
              path: "ex:priority",
              datatype: "xsd:integer",
              minInclusive: 1,
              maxInclusive: 10,
              minCount: 1,
              maxCount: 1
            },
            {
              type: "sh:PropertyShape",
              path: "ex:tags",
              datatype: "xsd:string",
              minLength: 2,
              maxLength: 20,
              minCount: 1,
              maxCount: 5
            }
          ]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const schema = result.value;
        const shape = schema.shapes![0];
        
        // The shape should have an AND at the top level
        const shapeExpr = shape.shapeExpr as ShEx.ShapeAnd;
        expect(shapeExpr.type).toBe("ShapeAnd");
        expect(shapeExpr.shapeExprs.length).toBeGreaterThan(1);
      }
    });
  });
});