/**
 * SHACL to ShEx Converter Library
 * 
 * A comprehensive, functional implementation for converting SHACL shapes to ShEx schemas
 * 
 * @see https://www.w3.org/TR/shacl/ - SHACL 1.1 Specification
 * @see http://shex.io/shex-semantics/ - ShEx 2.1 Specification
 */

// Export main converter
export { 
  convert, 
  convertShaclToShex,
  ConversionOptions,
  ConversionError,
  ConversionContext
} from './converters/shacl-to-shex-converter';

// Export SHACL types
export * as SHACL from './types/shacl-types';

// Export ShEx types  
export * as ShEx from './types/shex-types';

// Export mapping documentation
export { 
  SHACL_TO_SHEX_MAPPINGS,
  MappingRule,
  getMappingForShaclConstruct,
  getMappingsByCategory
} from './mappings/shacl-shex-mapping';

// Export functional utilities
export {
  Result,
  Maybe,
  pipe,
  compose,
  mapObject,
  filterObject,
  memoize,
  curry,
  partial,
  identity,
  constant,
  flatten,
  groupBy,
  unique,
  collectResults
} from './utils/functional-helpers';

// Re-export Result helpers for convenience
export { Result as R } from './utils/functional-helpers';

/**
 * Quick conversion function for simple use cases
 * 
 * @param shaclInput - SHACL shapes graph as JSON string or object
 * @returns ShEx schema as JSON string or error message
 */
export function quickConvert(shaclInput: string | object): string {
  const input = typeof shaclInput === 'string' ? shaclInput : JSON.stringify(shaclInput);
  const result = convert(input);
  
  if (Result.isOk(result)) {
    return JSON.stringify(result.value, null, 2);
  } else {
    return `Error: ${result.error.type} - ${result.error.details || result.error.message || 'Unknown error'}`;
  }
}

/**
 * Validate if a SHACL construct is supported for conversion
 * 
 * @param construct - SHACL construct name (e.g., "sh:minCount")
 * @returns true if the construct is supported
 */
export function isSupportedConstruct(construct: string): boolean {
  return getMappingForShaclConstruct(construct) !== undefined;
}

/**
 * Get all supported SHACL constructs
 * 
 * @returns Array of supported SHACL construct names
 */
export function getSupportedConstructs(): string[] {
  return SHACL_TO_SHEX_MAPPINGS.map(m => m.shaclConstruct);
}

/**
 * Library version
 */
export const VERSION = '2.0.0';

/**
 * Library metadata
 */
export const metadata = {
  name: 'shacl-to-shex',
  version: VERSION,
  description: 'Feature-complete SHACL to ShEx converter with functional programming approach',
  specifications: {
    shacl: '1.1',
    shex: '2.1'
  },
  repository: 'https://github.com/jeswr/shacl-to-shex',
  author: 'Jesse Wright',
  license: 'MIT'
};

// Default export for CommonJS compatibility
export default {
  convert,
  quickConvert,
  isSupportedConstruct,
  getSupportedConstructs,
  VERSION,
  metadata
};
