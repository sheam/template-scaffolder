/**
 * template-scaffolder/source: read declarations from source files in any supported language.
 *
 * ```ts
 * import { readSource } from 'template-scaffolder/source';
 * const roles = (await readSource('src/enums.ts')).enum('BusinessRoles').members.map(m => m.name);
 * ```
 */
export {
  BUILT_IN_READERS,
  checkSourceReader,
  defineSourceReader,
  readSource,
  readSources,
  registerSourceReader,
  withQueries,
} from './api.js';
export { loadGrammar, parse as parseWithGrammar } from './treeSitter.js';
export * as tsTypes from './typeHelpers/typescript.js';
export * as csharpTypes from './typeHelpers/csharp.js';
export * as cppTypes from './typeHelpers/cpp.js';
export type * from './types.js';
