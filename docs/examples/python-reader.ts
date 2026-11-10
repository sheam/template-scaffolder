/**
 * Example: a source reader for Python, built on a tree-sitter grammar.
 * The walkthrough in docs/writing-a-source-reader.md explains it step by step.
 *
 * Needs the grammar: npm install --save-dev tree-sitter-python
 *
 * Reads classes (dataclasses, enums), their annotated fields and methods, and
 * top-level functions:
 *   readers: [pythonReader]
 *   variables: async ({ source }) => ({ MODEL: (await source.read('app/models.py')).class('Tank') })
 */
import { createRequire } from 'node:module';
import {
  defineSourceReader,
  parseWithGrammar,
  type IFieldDecl,
  type IFunctionDecl,
  type IParamDecl,
  type ITypeDecl,
  type SyntaxNode,
} from 'template-scaffolder/source';

const GRAMMAR = createRequire(import.meta.url).resolve(
  'tree-sitter-python/tree-sitter-python.wasm'
);

export const pythonReader = defineSourceReader({
  id: 'python',
  extensions: ['.py', '.pyi'],
  async read({ path, text }) {
    const root = await parseWithGrammar(GRAMMAR, text);
    const types: ITypeDecl[] = [];
    const functions: IFunctionDecl[] = [];
    for (const node of root.namedChildren) {
      const { definition, decorators } = unwrapDecorators(node);
      if (definition?.type === 'class_definition') {
        types.push(readClass(definition, decorators));
      } else if (definition?.type === 'function_definition') {
        functions.push(readFunction(definition, decorators));
      }
    }
    return {
      path,
      language: 'python',
      text,
      types,
      functions,
      namespaces: [],
      hasErrors: root.hasError,
    };
  },
});

/** `@dataclass class X` is a decorated_definition wrapping the class. */
function unwrapDecorators(node: SyntaxNode | null): {
  definition: SyntaxNode | null;
  decorators: string[];
} {
  if (node?.type !== 'decorated_definition') {
    return { definition: node, decorators: [] };
  }
  return {
    definition: node.childForFieldName('definition'),
    decorators: node.namedChildren
      .filter(c => c?.type === 'decorator')
      .map(d => d!.text.replace(/^@/, '')),
  };
}

function readClass(node: SyntaxNode, decorators: string[]): ITypeDecl {
  const name = node.childForFieldName('name')?.text ?? '';
  const bases =
    node.childForFieldName('superclasses')?.namedChildren.map(b => b!.text) ??
    [];
  const isEnum = bases.some(b => /\b(Enum|IntEnum|StrEnum|Flag)$/.test(b));
  const body = node.childForFieldName('body');
  const statements = body?.namedChildren.filter(s => s !== null) ?? [];

  const fields: IFieldDecl[] = [];
  const members: ITypeDecl['members'] = [];
  const methods: IFunctionDecl[] = [];
  for (const statement of statements) {
    const assignment =
      statement.type === 'expression_statement'
        ? statement.firstNamedChild
        : null;
    if (assignment?.type === 'assignment') {
      const left = assignment.childForFieldName('left')?.text ?? '';
      const type = assignment.childForFieldName('type')?.text;
      const value = assignment.childForFieldName('right')?.text;
      if (isEnum) {
        members.push({ name: left, value });
      } else if (type !== undefined) {
        fields.push({
          name: left,
          type,
          optional: value !== undefined || /\bNone\b|Optional\[/.test(type),
          static: /^ClassVar\[/.test(type),
          readonly: false,
          attributes: [],
        });
      }
      continue;
    }
    const { definition, decorators: methodDecorators } =
      unwrapDecorators(statement);
    if (definition?.type === 'function_definition') {
      methods.push(readFunction(definition, methodDecorators, true));
    }
  }

  return {
    name,
    kind: isEnum ? 'enum' : 'class',
    exported: !name.startsWith('_'),
    bases,
    typeParams: [],
    fields,
    methods,
    members,
    attributes: decorators,
    doc: docstring(statements[0]),
    text: node.text,
    raw: node,
  };
}

function readFunction(
  node: SyntaxNode,
  decorators: string[],
  isMethod = false
): IFunctionDecl {
  const name = node.childForFieldName('name')?.text ?? '';
  const params = (node.childForFieldName('parameters')?.namedChildren ?? [])
    .filter(p => p !== null)
    .map(readParam)
    .filter(p => p !== null);
  const body = node.childForFieldName('body');
  return {
    name,
    // Leave out self / cls. Static methods have neither.
    params:
      isMethod && !decorators.includes('staticmethod')
        ? params.slice(1)
        : params,
    returnType: node.childForFieldName('return_type')?.text ?? '',
    async: node.children.some(c => c?.type === 'async'),
    static: decorators.includes('staticmethod'),
    access: name.startsWith('_') && !name.endsWith('__') ? 'private' : 'public',
    attributes: decorators,
    doc: docstring(body?.firstNamedChild ?? null),
    bodyText: body?.text,
    text: node.text,
    raw: node,
  };
}

function readParam(node: SyntaxNode): IParamDecl | null {
  switch (node.type) {
    case 'identifier':
      return { name: node.text, type: '', optional: false };
    case 'typed_parameter':
      return {
        name: node.firstNamedChild?.text ?? '',
        type: node.childForFieldName('type')?.text ?? '',
        optional: false,
      };
    case 'default_parameter':
    case 'typed_default_parameter':
      return {
        name: node.childForFieldName('name')?.text ?? '',
        type: node.childForFieldName('type')?.text ?? '',
        optional: true,
        default: node.childForFieldName('value')?.text,
      };
    case 'list_splat_pattern':
    case 'dictionary_splat_pattern':
      // *args and **kwargs: keep the stars in the name.
      return { name: node.text, type: '', optional: true };
    default:
      return null; // the bare `*` and `/` separators
  }
}

/** A string literal as the first statement of a class or function body. */
function docstring(
  statement: SyntaxNode | null | undefined
): string | undefined {
  const literal =
    statement?.type === 'expression_statement'
      ? statement.firstNamedChild
      : null;
  if (literal?.type !== 'string') return undefined;
  return literal.namedChildren
    .filter(c => c?.type === 'string_content')
    .map(c => c!.text)
    .join('')
    .trim();
}
