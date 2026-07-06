/**
 * Serialization of a ShexJ `Schema` to ShExC text, via `@shexjs/writer`.
 */
import Writer from '@shexjs/writer';
import type { Schema } from 'shexj';

/** Writes a ShexJ schema as ShExC text, using `prefixes` for compaction. */
export function writeShexSchema(schema: Schema, prefixes?: Record<string, string>): Promise<string> {
  const shexWriter = new Writer({ prefixes }, {});
  return new Promise<string>((resolve, reject) => {
    shexWriter.writeSchema(
      schema,
      (error: Error | null | undefined, text?: string) => {
        if (error) reject(error);
        else if (text !== undefined) resolve(text);
      },
    );
  });
}
