/**
 * Serialization of a ShexJ `Schema` to ShExC text, via `@shexjs/writer`.
 */
import Writer from '@shexjs/writer';
import type { Schema } from 'shexj';

/**
 * The characters ShExC allows after a backslash inside a REGEXP token
 * (grammar: `'/' ([^/\\\n\r] | '\\' [nrt\\|.?*+(){}$\-\[\]^/] | UCHAR)* '/'`).
 * `/` is deliberately excluded: `@shexjs/writer` escapes every `/` itself, so
 * keeping a `\/` pair here would let the writer turn it into the invalid `\\/`
 * (the backslash is instead UCHAR-encoded and the writer escapes the slash).
 */
const SHEXC_REGEX_ESCAPABLE = new Set('nrt\\|.?*+(){}$-[]^');

/**
 * Re-encodes a ShEx `pattern` facet value so that the ShExC the writer emits
 * stays within the REGEXP grammar. Regex class escapes such as `\d`, `\w`,
 * `\s` or `\p{L}` are valid in the ShExJ pattern value, but lexically illegal
 * in a ShExC regex literal, where a backslash may only precede
 * `[nrt\|.?*+(){}$\-\[\]^/]` or form a UCHAR — `@shexjs/writer` emits them
 * verbatim, producing schemas that conformant parsers reject. Encoding the
 * offending backslash as the UCHAR `\u005C` (and raw line terminators,
 * which the grammar also forbids, as `\u000A` / `\u000D`) keeps the
 * emitted text parseable; parsers decode the UCHARs back to the original
 * pattern.
 */
function shexcSafePattern(pattern: string): string {
  let safe = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '\\' && SHEXC_REGEX_ESCAPABLE.has(pattern[i + 1])) {
      safe += char + pattern[i + 1];
      i += 1;
    } else if (char === '\\') {
      safe += '\\u005C';
    } else if (char === '\n') {
      safe += '\\u000A';
    } else if (char === '\r') {
      safe += '\\u000D';
    } else {
      safe += char;
    }
  }
  return safe;
}

/**
 * Deep-copies a ShexJ node, re-encoding every `NodeConstraint` `pattern`
 * facet via {@link shexcSafePattern}. The caller's schema is left untouched
 * (the in-memory ShExJ pattern is correct as-is; only ShExC needs encoding).
 */
function withShexcSafePatterns<T>(node: T): T {
  if (Array.isArray(node)) {
    return node.map(withShexcSafePatterns) as unknown as T;
  }
  if (node !== null && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      copy[key] = key === 'pattern' && record.type === 'NodeConstraint' && typeof record[key] === 'string'
        ? shexcSafePattern(record[key] as string)
        : withShexcSafePatterns(record[key]);
    }
    return copy as T;
  }
  return node;
}

/** Writes a ShexJ schema as ShExC text, using `prefixes` for compaction. */
export function writeShexSchema(schema: Schema, prefixes?: Record<string, string>): Promise<string> {
  const shexWriter = new Writer({ prefixes }, {});
  return new Promise<string>((resolve, reject) => {
    shexWriter.writeSchema(
      withShexcSafePatterns(schema),
      (error: Error | null | undefined, text?: string) => {
        if (error) reject(error);
        else if (text !== undefined) resolve(text);
      },
    );
  });
}
