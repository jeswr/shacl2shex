import imp from "@shexjs/parser";
const parser = imp.construct('http://www.w3.org/ns/shacl-shacl#');
console.log(JSON.stringify(parser.parse(`
PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX shsh: <http://www.w3.org/ns/shacl-shacl#>

shsh:ShapeShape {
      sh:deactivated [true false]?;
}`), null, 2))