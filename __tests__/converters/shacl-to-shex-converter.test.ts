/**
 * Test suite for SHACL to ShEx Converter
 * Based on SHACL 1.1 Test Suite: https://w3c.github.io/data-shapes/shacl/
 */

import { describe, it, expect } from '@jest/globals';
import { convert, Result } from '../../lib/converters/shacl-to-shex-converter';
import * as SHACL from '../../lib/types/shacl-types';
import * as ShEx from '../../lib/types/shex-types';

describe('SHACL to ShEx Converter', () => {
  
  describe('Basic Shape Conversion', () => {
    
    it('should convert a simple NodeShape', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:PersonShape",
          targetClass: ["ex:Person"]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.type).toBe("Schema");
        expect(result.value.shapes).toHaveLength(1);
        expect(result.value.shapes![0].id).toBe("ex:PersonShape");
      }
    });
    
    it('should convert NodeShape with nodeKind constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:IRIShape",
          nodeKind: SHACL.NodeKind.IRI
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shapeExpr = result.value.shapes![0].shapeExpr as ShEx.NodeConstraint;
        expect(shapeExpr.type).toBe("NodeConstraint");
        expect(shapeExpr.nodeKind).toBe("iri");
      }
    });
  });
  
  describe('Property Shape Conversion', () => {
    
    it('should convert PropertyShape with path and datatype', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:PersonShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:name",
            datatype: "xsd:string"
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        expect(shape.type).toBe("Shape");
        
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        expect(tripleExpr.type).toBe("TripleConstraint");
        expect(tripleExpr.predicate).toBe("ex:name");
        
        const valueExpr = tripleExpr.valueExpr as ShEx.NodeConstraint;
        expect(valueExpr.datatype).toBe("xsd:string");
      }
    });
  });
  
  describe('Cardinality Constraints (SHACL Test Suite)', () => {
    
    it('should convert sh:minCount constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:MinCountShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:property",
            minCount: 2
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        expect(tripleExpr.min).toBe(2);
      }
    });
    
    it('should convert sh:maxCount constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:MaxCountShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:property",
            maxCount: 3
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        expect(tripleExpr.max).toBe(3);
      }
    });
    
    it('should convert both minCount and maxCount', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:CardinalityShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:property",
            minCount: 1,
            maxCount: 5
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        expect(tripleExpr.min).toBe(1);
        expect(tripleExpr.max).toBe(5);
      }
    });
  });
  
  describe('Value Type Constraints (SHACL Test Suite)', () => {
    
    it('should convert sh:datatype constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:DatatypeShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:age",
            datatype: "xsd:integer"
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        const valueExpr = tripleExpr.valueExpr as ShEx.NodeConstraint;
        expect(valueExpr.datatype).toBe("xsd:integer");
      }
    });
    
    it('should convert sh:nodeKind sh:IRI', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:IRIValueShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:link",
            nodeKind: SHACL.NodeKind.IRI
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        const valueExpr = tripleExpr.valueExpr as ShEx.NodeConstraint;
        expect(valueExpr.nodeKind).toBe("iri");
      }
    });
    
    it('should convert sh:nodeKind sh:Literal', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:LiteralValueShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:label",
            nodeKind: SHACL.NodeKind.Literal
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        const valueExpr = tripleExpr.valueExpr as ShEx.NodeConstraint;
        expect(valueExpr.nodeKind).toBe("literal");
      }
    });
  });
  
  describe('String Constraints (SHACL Test Suite)', () => {
    
    it('should convert sh:pattern constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:PatternShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:code",
            pattern: "^[A-Z]{3}$",
            flags: "i"
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        const valueExpr = tripleExpr.valueExpr as ShEx.NodeConstraint;
        expect(valueExpr.pattern).toBe("^[A-Z]{3}$");
        expect(valueExpr.flags).toBe("i");
      }
    });
    
    it('should convert sh:minLength and sh:maxLength', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:LengthShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:description",
            minLength: 10,
            maxLength: 100
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        const valueExpr = tripleExpr.valueExpr as ShEx.NodeConstraint;
        expect(valueExpr.minlength).toBe(10);
        expect(valueExpr.maxlength).toBe(100);
      }
    });
  });
  
  describe('Numeric Constraints (SHACL Test Suite)', () => {
    
    it('should convert sh:minInclusive and sh:maxInclusive', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:RangeShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:score",
            minInclusive: 0,
            maxInclusive: 100
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        const valueExpr = tripleExpr.valueExpr as ShEx.NodeConstraint;
        expect(valueExpr.mininclusive).toBe(0);
        expect(valueExpr.maxinclusive).toBe(100);
      }
    });
    
    it('should convert sh:minExclusive and sh:maxExclusive', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:ExclusiveRangeShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:temperature",
            minExclusive: -273.15,
            maxExclusive: 1000
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        const valueExpr = tripleExpr.valueExpr as ShEx.NodeConstraint;
        expect(valueExpr.minexclusive).toBe(-273.15);
        expect(valueExpr.maxexclusive).toBe(1000);
      }
    });
  });
  
  describe('Value Set Constraints (SHACL Test Suite)', () => {
    
    it('should convert sh:in constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:InShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:status",
            in: ["active", "inactive", "pending"]
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        const valueExpr = tripleExpr.valueExpr as ShEx.NodeConstraint;
        expect(valueExpr.values).toHaveLength(3);
        expect(valueExpr.values![0]).toBe("active");
      }
    });
    
    it('should convert sh:hasValue constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:HasValueShape",
          property: [{
            type: "sh:PropertyShape",
            path: "rdf:type",
            hasValue: ["ex:Person"]
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      // Note: hasValue requires special handling in the converter
    });
  });
  
  describe('Logical Constraints (SHACL Test Suite)', () => {
    
    it('should convert sh:and constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:AndShape",
          and: [
            {
              type: "sh:NodeShape",
              nodeKind: SHACL.NodeKind.IRI
            },
            {
              type: "sh:NodeShape",
              datatype: "xsd:string"
            }
          ]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shapeExpr = result.value.shapes![0].shapeExpr as ShEx.ShapeAnd;
        expect(shapeExpr.type).toBe("ShapeAnd");
        expect(shapeExpr.shapeExprs).toHaveLength(2);
      }
    });
    
    it('should convert sh:or constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:OrShape",
          or: [
            {
              type: "sh:NodeShape",
              datatype: "xsd:string"
            },
            {
              type: "sh:NodeShape",
              datatype: "xsd:integer"
            }
          ]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shapeExpr = result.value.shapes![0].shapeExpr as ShEx.ShapeOr;
        expect(shapeExpr.type).toBe("ShapeOr");
        expect(shapeExpr.shapeExprs).toHaveLength(2);
      }
    });
    
    it('should convert sh:not constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:NotShape",
          not: [{
            type: "sh:NodeShape",
            datatype: "xsd:string"
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shapeExpr = result.value.shapes![0].shapeExpr as ShEx.ShapeNot;
        expect(shapeExpr.type).toBe("ShapeNot");
        expect(shapeExpr.shapeExpr).toBeDefined();
      }
    });
  });
  
  describe('Shape References (SHACL Test Suite)', () => {
    
    it('should convert sh:node constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:PersonShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:knows",
            node: ["ex:PersonShape"]
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        const tripleExpr = shape.expression as ShEx.TripleConstraint;
        const valueExpr = tripleExpr.valueExpr as ShEx.ShapeRef;
        expect(valueExpr.type).toBe("ShapeRef");
        expect(valueExpr.reference).toBe("ex:PersonShape");
      }
    });
  });
  
  describe('Closed Shapes (SHACL Test Suite)', () => {
    
    it('should convert sh:closed with sh:ignoredProperties', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:ClosedShape",
          closed: true,
          ignoredProperties: ["rdf:type"],
          property: [{
            type: "sh:PropertyShape",
            path: "ex:name",
            datatype: "xsd:string"
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const shape = result.value.shapes![0].shapeExpr as ShEx.Shape;
        expect(shape.closed).toBe(true);
        expect(shape.extra).toEqual(["rdf:type"]);
      }
    });
  });
  
  describe('Language Constraints (SHACL Test Suite)', () => {
    
    it('should convert sh:languageIn constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:LanguageShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:label",
            languageIn: ["en", "es", "fr"]
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      // Note: languageIn requires special handling in the converter
    });
    
    it('should convert sh:uniqueLang constraint', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:UniqueLangShape",
          property: [{
            type: "sh:PropertyShape",
            path: "ex:label",
            uniqueLang: true
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      // Note: uniqueLang requires special handling in the converter
    });
  });
  
  describe('Complex Shapes', () => {
    
    it('should convert a complex person shape', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        prefixes: [
          { prefix: "ex", namespace: "http://example.org/" },
          { prefix: "xsd", namespace: "http://www.w3.org/2001/XMLSchema#" }
        ],
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:PersonShape",
          targetClass: ["ex:Person"],
          nodeKind: SHACL.NodeKind.IRI,
          closed: true,
          ignoredProperties: ["rdf:type"],
          property: [
            {
              type: "sh:PropertyShape",
              path: "ex:name",
              datatype: "xsd:string",
              minCount: 1,
              maxCount: 1,
              minLength: 1,
              maxLength: 100
            },
            {
              type: "sh:PropertyShape",
              path: "ex:age",
              datatype: "xsd:integer",
              minInclusive: 0,
              maxInclusive: 150,
              maxCount: 1
            },
            {
              type: "sh:PropertyShape",
              path: "ex:email",
              datatype: "xsd:string",
              pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
              minCount: 0
            },
            {
              type: "sh:PropertyShape",
              path: "ex:knows",
              node: ["ex:PersonShape"],
              minCount: 0
            }
          ]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        const schema = result.value;
        expect(schema.prefixes).toBeDefined();
        expect(schema.prefixes!["ex"]).toBe("http://example.org/");
        
        const shape = schema.shapes![0].shapeExpr as ShEx.Shape;
        expect(shape.closed).toBe(true);
        expect(shape.extra).toEqual(["rdf:type"]);
        
        const eachOf = shape.expression as ShEx.EachOf;
        expect(eachOf.type).toBe("EachOf");
        expect(eachOf.expressions).toHaveLength(4);
      }
    });
  });
  
  describe('Error Handling', () => {
    
    it('should handle invalid input gracefully', () => {
      const result = convert("invalid json");
      
      expect(Result.isError(result)).toBe(true);
      if (Result.isError(result)) {
        expect(result.error.type).toBe('InvalidInput');
      }
    });
    
    it('should handle unsupported property paths', () => {
      const shaclGraph: SHACL.ShapesGraph = {
        shapes: [{
          type: "sh:NodeShape",
          id: "ex:ComplexPathShape",
          property: [{
            type: "sh:PropertyShape",
            path: {
              type: "SequencePath",
              paths: ["ex:knows", "ex:name"]
            } as SHACL.SequencePath,
            datatype: "xsd:string"
          }]
        }]
      };
      
      const result = convert(shaclGraph);
      
      expect(Result.isError(result)).toBe(true);
      if (Result.isError(result)) {
        expect(result.error.type).toBe('UnsupportedConstruct');
      }
    });
  });
});