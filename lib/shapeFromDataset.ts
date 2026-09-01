import { LdoBase, ShapeType, createLdoDataset } from '@ldo/ldo';
import { DatasetCore, NamedNode, BlankNode } from '@rdfjs/types';
import RdfJsDb from '@shexjs/neighborhood-rdfjs';
import { ShExValidator } from '@shexjs/validator';
import TermSet from '@rdfjs/term-set';

export function getSubjects(dataset: DatasetCore): TermSet<NamedNode | BlankNode> {
  const subjects = new TermSet<NamedNode | BlankNode>();

  for (const quad of dataset) {
    if (
      quad.subject.termType === 'NamedNode'
        || quad.subject.termType === 'BlankNode'
    ) subjects.add(quad.subject);
  }

  return subjects;
}

export function shapeFromDatasetFactory<T extends LdoBase>(
  shapeType: ShapeType<T>,
  dataset: DatasetCore,
) {
  const validator = new ShExValidator(shapeType.schema, (RdfJsDb as any).ctor(dataset));
  const ldoDataset = createLdoDataset([...dataset]);
  return (subject: NamedNode | BlankNode | string): T => {
    const validationResult = validator.validateShapeMap([{
      node: typeof subject === 'string' ? subject : subject.value,
      shape: shapeType.shape,
    }]);
    if (validationResult[0].status !== 'conformant') {
      throw new Error(JSON.stringify(validationResult, null, 2));
    }
    return ldoDataset.usingType(shapeType).fromSubject(subject);
  };
}

export function shapeFromDataset<T extends LdoBase>(
  shapeType: ShapeType<T>,
  dataset: DatasetCore,
  subject: NamedNode | BlankNode | string,
): T {
  return shapeFromDatasetFactory(shapeType, dataset)(subject);
}

export function* shapeMatches<T extends LdoBase>(shapeType: ShapeType<T>, dataset: DatasetCore) {
  const shapeData = shapeFromDatasetFactory(shapeType, dataset);
  for (const subject of getSubjects(dataset)) {
    try {
      yield shapeData(subject);
    } catch (e) {
      // Do nothing, not all subjects will match every shape
    }
  }
}
