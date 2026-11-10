/**
 * Rewrites one 2.x config or helper file to the 3.x shape with minimal text edits,
 * so formatting and comments are kept. Pure: text in, text out.
 */
import { type Node, namedChildren, parse } from '../source/treeSitter.js';

export interface IMigrateProblem {
  line: number;
  message: string;
}

export interface IMigrateFileResult {
  text: string;
  changes: string[];
  problems: IMigrateProblem[];
}

interface IEdit {
  start: number;
  end: number;
  text: string;
}

/** 2.x type names exported from the package; used to recognise its type imports. */
const PACKAGE_TYPES = new Set([
  'IConfigFile',
  'Question',
  'IChoice',
  'IPathInfo',
  'TemplateVariables',
  'MacroObject',
  'PatternList',
  'IQuestionBase',
  'IInputQuestion',
  'IWordsQuestion',
  'INumberQuestion',
  'IConfirmQuestion',
  'ISelectQuestion',
  'ISearchQuestion',
  'IPathSelectQuestion',
]);

/** Positional 2.x parameters, in order, and the v3 context type for each config function. */
const FUNCTION_SHAPES: Record<
  string,
  { keys: string[]; contextType: string; generic: boolean }
> = {
  prompts: { keys: ['name'], contextType: 'IPromptsContext', generic: false },
  variables: {
    keys: ['name', 'answers'],
    contextType: 'IVariablesContext',
    generic: true,
  },
  macros: {
    keys: ['name', 'answers', 'variables'],
    contextType: 'IMacrosContext',
    generic: true,
  },
  afterFileCreated: {
    keys: ['path', 'dryRun', 'variables'],
    contextType: 'IFileHookContext',
    generic: false,
  },
};

const FUNCTION_NODES = new Set([
  'arrow_function',
  'function_expression',
  'function',
]);

class Migration {
  readonly edits: IEdit[] = [];
  readonly changes: string[] = [];
  readonly problems: IMigrateProblem[] = [];
  readonly neededTypes = new Set<string>();
  packageImport: Node | null = null;
  /** Parameter counts of functions declared in the project's helper files, by name. */
  arities: Record<string, number> = {};

  constructor(
    readonly text: string,
    readonly typed: boolean
  ) {}

  edit(
    node: Node | { startIndex: number; endIndex: number },
    text: string
  ): void {
    this.edits.push({ start: node.startIndex, end: node.endIndex, text });
  }

  problem(node: Node, message: string): void {
    this.problems.push({ line: node.startPosition.row + 1, message });
  }

  apply(): string {
    const sorted = [...this.edits].sort((a, b) => b.start - a.start);
    let out = this.text;
    let lastStart = Infinity;
    for (const e of sorted) {
      if (e.end > lastStart) continue; // overlapping edit: keep the outermost-later one
      out = out.slice(0, e.start) + e.text + out.slice(e.end);
      lastStart = e.start;
    }
    return out;
  }
}

function walk(node: Node, visit: (n: Node) => void): void {
  visit(node);
  for (const c of namedChildren(node)) walk(c, visit);
}

function unwrapExpression(node: Node | null): Node | null {
  let n = node;
  while (n) {
    if (
      n.type === 'parenthesized_expression' ||
      n.type === 'as_expression' ||
      n.type === 'satisfies_expression' ||
      n.type === 'type_assertion' ||
      n.type === 'non_null_expression'
    ) {
      n = namedChildren(n)[0] ?? null;
      continue;
    }
    if (
      n.type === 'call_expression' &&
      n.childForFieldName('function')?.text === 'defineConfig'
    ) {
      n = namedChildren(n.childForFieldName('arguments') ?? n)[0] ?? null;
      continue;
    }
    return n;
  }
  return null;
}

function isConfigType(typeText: string | undefined): boolean {
  return (
    !!typeText &&
    /^(Promise<\s*)?IConfigFile\b/.test(typeText.replace(/^:\s*/, ''))
  );
}

/** Object literals that are template configs. */
function findConfigObjects(root: Node): Node[] {
  const found = new Map<number, Node>();
  const add = (n: Node | null): void => {
    const obj = unwrapExpression(n);
    if (obj?.type === 'object') found.set(obj.id, obj);
  };
  const defaultExportNames = new Set<string>();

  walk(root, n => {
    // export default {...} / export default name
    if (
      n.type === 'export_statement' &&
      n.children.some(c => c?.type === 'default')
    ) {
      const value =
        n.childForFieldName('value') ?? namedChildren(n).at(-1) ?? null;
      const unwrapped = unwrapExpression(value);
      if (unwrapped?.type === 'identifier')
        defaultExportNames.add(unwrapped.text);
      else add(value);
    }
    // module.exports = ...
    if (
      n.type === 'assignment_expression' &&
      n.childForFieldName('left')?.text === 'module.exports'
    ) {
      const right = n.childForFieldName('right');
      const unwrapped = unwrapExpression(right);
      if (unwrapped?.type === 'identifier')
        defaultExportNames.add(unwrapped.text);
      else add(right);
    }
    // {...} as IConfigFile / satisfies IConfigFile
    if (
      (n.type === 'as_expression' || n.type === 'satisfies_expression') &&
      isConfigType(namedChildren(n)[1]?.text)
    ) {
      add(n);
    }
    // const x: IConfigFile = {...}
    if (
      n.type === 'variable_declarator' &&
      isConfigType(n.childForFieldName('type')?.text)
    ) {
      add(n.childForFieldName('value'));
    }
    // function f(): IConfigFile { return {...} } / (): IConfigFile => ({...})
    if (
      (n.type === 'function_declaration' ||
        FUNCTION_NODES.has(n.type) ||
        n.type === 'method_definition') &&
      isConfigType(n.childForFieldName('return_type')?.text)
    ) {
      const body = n.childForFieldName('body');
      if (body && body.type !== 'statement_block') add(body);
      else if (body) {
        walk(body, r => {
          if (r.type === 'return_statement') add(namedChildren(r)[0] ?? null);
        });
      }
    }
  });

  if (defaultExportNames.size) {
    walk(root, n => {
      if (
        n.type === 'variable_declarator' &&
        defaultExportNames.has(n.childForFieldName('name')?.text ?? '')
      ) {
        add(n.childForFieldName('value'));
      }
    });
  }
  return [...found.values()];
}

function propertyName(pair: Node): string | null {
  const key = pair.childForFieldName('key') ?? pair.childForFieldName('name');
  if (!key) return null;
  return key.text.replace(/^['"]|['"]$/g, '');
}

function properties(obj: Node): Node[] {
  return namedChildren(obj).filter(
    c => c.type === 'pair' || c.type === 'method_definition'
  );
}

/** `(p0: A, p1: B)` -> `({ k0: p0, k1: p1 }: Ctx<B>)` */
function contextParameter(
  m: Migration,
  list: Node[],
  prop: string
): string | null {
  const shape = FUNCTION_SHAPES[prop];
  if (list.length === 0) return null;
  if (list.length > shape.keys.length) {
    m.problem(
      list[0],
      `'${prop}' has ${list.length} parameters; 2.x only passed ${shape.keys.length}. Converted the first ${shape.keys.length}.`
    );
  }
  const parts: string[] = [];
  let answersType: string | undefined;
  let anyTyped = false;
  list.slice(0, shape.keys.length).forEach((p, i) => {
    const key = shape.keys[i];
    const pattern =
      p.type === 'identifier' ? p : p.childForFieldName('pattern');
    const value = p.childForFieldName('value');
    const typeNode =
      p.type === 'identifier' ? null : p.childForFieldName('type');
    if (typeNode) anyTyped = true;
    if (key === 'answers' && typeNode)
      answersType = typeNode.text.replace(/^:\s*/, '');
    const local = pattern?.text ?? key;
    const def = value ? ` = ${value.text}` : '';
    parts.push(local === key && !def ? key : `${key}: ${local}${def}`);
  });
  let typeAnnotation = '';
  if (m.typed && anyTyped) {
    m.neededTypes.add(shape.contextType);
    const generic =
      shape.generic && answersType && answersType !== 'any'
        ? `<${answersType}>`
        : '';
    typeAnnotation = `: ${shape.contextType}${generic}`;
  }
  return `({ ${parts.join(', ')} }${typeAnnotation})`;
}

type FunctionOutcome = 'converted' | 'unchanged' | 'failed';

/** Rewrite a config function's parameters in place. */
function migrateFunction(
  m: Migration,
  fn: Node,
  prop: string
): FunctionOutcome {
  const params =
    fn.childForFieldName('parameters') ?? fn.childForFieldName('parameter');
  if (!params) return 'failed';
  // Arrow function with a single bare parameter: `name => ...`
  const list =
    params.type === 'identifier'
      ? [params]
      : namedChildren(params).filter(
          p =>
            p.type === 'required_parameter' ||
            p.type === 'optional_parameter' ||
            p.type === 'identifier'
        );
  const first = list[0];
  if (!first) return 'unchanged'; // no parameters: nothing to change
  const firstPattern =
    first.type === 'identifier'
      ? first
      : (first.childForFieldName('pattern') ?? first);
  if (firstPattern.type === 'object_pattern') return 'unchanged'; // already v3
  if (/\barguments\b/.test(fn.childForFieldName('body')?.text ?? '')) {
    m.problem(fn, `'${prop}' uses 'arguments'; convert it by hand.`);
    return 'failed';
  }
  const replacement = contextParameter(m, list, prop);
  if (!replacement) return 'unchanged';
  m.edit(params, replacement);
  return 'converted';
}

/** A reference (`formatFileCommand`) becomes an adapter arrow function. */
/**
 * A reference (`formatFileCommand`) becomes an adapter arrow function that passes the
 * 2.x positional arguments. If the function is declared in the project with fewer
 * parameters, only those are passed (so typed code still compiles).
 */
function adapter(m: Migration, valueText: string, prop: string): string {
  const all = FUNCTION_SHAPES[prop].keys;
  const arity = m.arities[valueText.split('.').pop() ?? valueText];
  const keys = arity === undefined ? all : all.slice(0, Math.max(1, arity));
  return `({ ${keys.join(', ')} }) => ${valueText}(${keys.join(', ')})`;
}

function migrateConfigObject(m: Migration, obj: Node): void {
  const props = properties(obj);
  const hooks = props.find(p => propertyName(p) === 'hooks');
  for (const p of props) {
    const name = propertyName(p);
    if (!name) continue;

    if (name === 'destinations' && p.type === 'pair') {
      const value = p.childForFieldName('value');
      if (
        value?.type === 'string' ||
        (value?.type === 'template_string' && !value.text.includes('${'))
      ) {
        m.edit(p.childForFieldName('key') ?? p, 'destination');
        m.changes.push(
          `destinations: ${value.text} -> destination (a single string means a fixed destination)`
        );
      }
      continue;
    }

    if (!(name in FUNCTION_SHAPES)) continue;
    const isHook = name === 'afterFileCreated';
    let newValue: string | null = null;

    if (p.type === 'method_definition') {
      // variables(name, inputs) { ... }
      const outcome = migrateFunction(m, p, name);
      if (outcome === 'failed') continue;
      if (isHook)
        m.problem(
          p,
          `method-style 'afterFileCreated' kept in place; move it into 'hooks' by hand.`
        );
      else if (outcome === 'converted')
        m.changes.push(`${name}(): parameters -> context object`);
      continue;
    }

    const value = p.childForFieldName('value');
    if (!value) continue;
    if (FUNCTION_NODES.has(value.type)) {
      const outcome = migrateFunction(m, value, name);
      if (outcome === 'failed') continue;
      if (!isHook) {
        if (outcome === 'converted')
          m.changes.push(`${name}: parameters -> context object`);
        continue;
      }
    } else if (
      value.type === 'identifier' ||
      value.type === 'member_expression'
    ) {
      newValue = adapter(m, value.text, name);
      if (!isHook) {
        m.edit(value, newValue);
        m.changes.push(
          `${name}: wrapped ${value.text} to receive the context object`
        );
        continue;
      }
    } else if (value.type === 'object' || value.type === 'array') {
      continue; // plain values are unchanged
    } else if (!isHook) {
      m.problem(
        value,
        `'${name}' is computed (${value.type}); if it produces a function, change it to take a context object.`
      );
      continue;
    }

    // afterFileCreated -> hooks.afterFileCreated
    if (hooks) {
      m.problem(
        p,
        `config has both 'afterFileCreated' and 'hooks'; move afterFileCreated into hooks by hand.`
      );
      continue;
    }
    const migratedValue = newValue ?? null;
    const key = p.childForFieldName('key');
    if (!key) continue;
    if (migratedValue) {
      m.edit(p, `hooks: { afterFileCreated: ${migratedValue} }`);
    } else {
      // function value already edited in place: wrap the pair around it
      m.edit(
        { startIndex: p.startIndex, endIndex: value.startIndex },
        'hooks: { afterFileCreated: '
      );
      m.edit({ startIndex: p.endIndex, endIndex: p.endIndex }, ' }');
    }
    m.changes.push(
      `afterFileCreated -> hooks.afterFileCreated with a context object`
    );
  }
}

/** Question objects anywhere in the file: list/fuzzypath types and maxDepth. */
function migrateQuestions(m: Migration, root: Node): void {
  walk(root, n => {
    if (n.type !== 'object') return;
    const props = properties(n);
    const hasMessage = props.some(p => propertyName(p) === 'message');
    if (!hasMessage) return;
    for (const p of props) {
      const name = propertyName(p);
      const value = p.childForFieldName('value');
      if (name === 'type' && value?.type === 'string') {
        const t = value.text.slice(1, -1);
        const replacement =
          t === 'list' ? 'select' : t === 'fuzzypath' ? 'path' : null;
        if (replacement) {
          const quote = value.text[0];
          m.edit(value, `${quote}${replacement}${quote}`);
          m.changes.push(`question type '${t}' -> '${replacement}'`);
        }
      }
      if (name === 'maxDepth') {
        m.edit(p.childForFieldName('key') ?? p, 'depthLimit');
        m.changes.push(`question maxDepth -> depthLimit`);
      }
    }
  });
}

function importSource(n: Node): Node | null {
  return n.childForFieldName('source');
}

function importedNames(n: Node): string[] {
  const clause = namedChildren(n).find(c => c.type === 'import_clause');
  const named =
    clause && namedChildren(clause).find(c => c.type === 'named_imports');
  return named
    ? namedChildren(named).map(s => (s.childForFieldName('name') ?? s).text)
    : [];
}

function migrateImports(m: Migration, root: Node): void {
  for (const n of namedChildren(root)) {
    if (n.type !== 'import_statement') continue;
    const source = importSource(n);
    if (!source) continue;
    const spec = source.text.slice(1, -1);
    const quote = source.text[0];
    const names = importedNames(n);
    const deepPackagePath = /^template-scaffolder\/(dist|src)(\/|$)/.test(spec);
    const relativeTypes =
      /^\.{1,2}\/.*\/types(\/index)?(\.[cm]?[jt]s)?$/.test(spec) &&
      names.length > 0 &&
      names.every(x => PACKAGE_TYPES.has(x));
    if (deepPackagePath || relativeTypes) {
      m.edit(source, `${quote}template-scaffolder${quote}`);
      m.changes.push(`import from '${spec}' -> 'template-scaffolder'`);
      m.packageImport = n;
    } else if (spec === 'template-scaffolder') {
      m.packageImport = n;
    }
  }
}

function addTypeImports(m: Migration, root: Node): void {
  if (!m.neededTypes.size) return;
  const names = [...m.neededTypes].sort();
  const existing = m.packageImport ? importedNames(m.packageImport) : [];
  const missing = names.filter(x => !existing.includes(x));
  if (!missing.length) return;
  const clause =
    m.packageImport &&
    namedChildren(m.packageImport).find(c => c.type === 'import_clause');
  const named =
    clause && namedChildren(clause).find(c => c.type === 'named_imports');
  if (named) {
    const isTypeOnly = m.packageImport?.children.some(c => c?.type === 'type');
    const add = missing.map(x => (isTypeOnly ? x : `type ${x}`)).join(', ');
    const close = named.endIndex - 1;
    const before = m.text.slice(named.startIndex, close).trimEnd();
    const sep = before.endsWith(',') || before.endsWith('{') ? ' ' : ', ';
    m.edit({ startIndex: close, endIndex: close }, `${sep}${add} `);
    return;
  }
  const imports = namedChildren(root).filter(
    c => c.type === 'import_statement'
  );
  const at = imports.length ? imports[imports.length - 1].endIndex : 0;
  const line = `import type { ${missing.join(', ')} } from 'template-scaffolder';`;
  m.edit(
    { startIndex: at, endIndex: at },
    imports.length ? `\n${line}` : `${line}\n`
  );
}

export interface IMigrateSourceOptions {
  /** File names to add to the config's `ignore` list (helpers that live in the template folder). */
  ignoreFiles?: string[];
  /** Parameter counts of helper functions by name, used when wrapping function references. */
  arities?: Record<string, number>;
}

/** Relative imports in a file, e.g. ['./helpers.js', '../_helpers/x']. */
export async function relativeImports(text: string): Promise<string[]> {
  const root = await parse('typescript', text);
  return namedChildren(root)
    .filter(n => n.type === 'import_statement')
    .map(n => importSource(n)?.text.slice(1, -1) ?? '')
    .filter(spec => spec.startsWith('./') || spec.startsWith('../'));
}

/** Add `ignore: [...]` as the first property of a config object that has none. */
function addIgnore(m: Migration, obj: Node, files: string[]): void {
  if (!files.length || properties(obj).some(p => propertyName(p) === 'ignore'))
    return;
  const first = properties(obj)[0];
  const list = files.map(f => `'${f}'`).join(', ');
  if (first) {
    const lineStart = m.text.lastIndexOf('\n', first.startIndex) + 1;
    const indent = m.text.slice(lineStart, first.startIndex);
    const sameLine = /^\s*$/.test(indent) ? `\n${indent}` : ' ';
    m.edit(
      { startIndex: first.startIndex, endIndex: first.startIndex },
      `ignore: [${list}],${sameLine}`
    );
  } else {
    m.edit(
      { startIndex: obj.startIndex + 1, endIndex: obj.startIndex + 1 },
      ` ignore: [${list}] `
    );
  }
  m.changes.push(
    `ignore: [${list}] added: 2.x copied ${files.length === 1 ? 'this helper' : 'these helpers'} into the generated output`
  );
}

export async function migrateSource(
  text: string,
  filePath: string,
  options: IMigrateSourceOptions = {}
): Promise<IMigrateFileResult> {
  const typed = /\.[cm]?tsx?$/.test(filePath);
  const root = await parse(
    /\.[jt]sx$/.test(filePath) ? 'tsx' : 'typescript',
    text
  );
  const m = new Migration(text, typed);
  m.arities = options.arities ?? {};
  if (root.hasError) {
    m.problems.push({
      line: 1,
      message: 'file has syntax errors; it was checked but may be incomplete.',
    });
  }
  migrateImports(m, root);
  const configs = findConfigObjects(root);
  for (const obj of configs) migrateConfigObject(m, obj);
  if (configs.length === 1) addIgnore(m, configs[0], options.ignoreFiles ?? []);
  migrateQuestions(m, root);
  addTypeImports(m, root);
  return {
    text: m.apply(),
    changes: [...new Set(m.changes)],
    problems: m.problems,
  };
}
