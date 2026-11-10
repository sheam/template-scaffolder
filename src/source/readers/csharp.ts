import { defineSourceReader } from '../api.js';
import {
  blockBody,
  childrenOfType,
  docComment,
  field,
  fieldText,
  type Node,
  namedChildren,
  parse,
} from '../treeSitter.js';
import type {
  Access,
  IFieldDecl,
  IFunctionDecl,
  IParamDecl,
  ITypeDecl,
  SourceFileData,
  TypeKind,
} from '../types.js';

const ACCESS = ['public', 'protected', 'private', 'internal'];

function modifiers(node: Node): string[] {
  return childrenOfType(node, 'modifier').map(m => m.text);
}

function access(mods: string[]): Access | undefined {
  return mods.find(m => ACCESS.includes(m)) as Access | undefined;
}

/** `[HttpGet("{id}")]` -> `HttpGet("{id}")` for each attribute. */
function attributes(node: Node): string[] {
  return childrenOfType(node, 'attribute_list').flatMap(list =>
    childrenOfType(list, 'attribute').map(a => a.text)
  );
}

function params(list: Node | null): IParamDecl[] {
  if (!list) return [];
  return childrenOfType(list, 'parameter').map(p => {
    const nameNode = field(p, 'name');
    const typeNode = field(p, 'type');
    // The default value is the named child after the name.
    const kids = namedChildren(p);
    const nameIndex = kids.findIndex(k => k.id === nameNode?.id);
    const defaultNode = nameIndex >= 0 ? kids[nameIndex + 1] : undefined;
    return {
      name: nameNode?.text ?? '',
      type: typeNode?.text ?? '',
      optional: defaultNode !== undefined || typeNode?.type === 'nullable_type',
      ...(defaultNode ? { default: defaultNode.text } : {}),
    };
  });
}

function method(node: Node): IFunctionDecl {
  const mods = modifiers(node);
  const body = field(node, 'body');
  return {
    name: fieldText(node, 'name'),
    params: params(field(node, 'parameters')),
    returnType: fieldText(node, 'returns') || fieldText(node, 'type'),
    async: mods.includes('async'),
    static: mods.includes('static'),
    access: access(mods),
    attributes: attributes(node),
    doc: docComment(node),
    bodyText:
      body?.type === 'block'
        ? blockBody(body)
        : body?.type === 'arrow_expression_clause'
          ? namedChildren(body)[0]?.text
          : undefined,
    text: node.text,
    raw: node,
  };
}

function fieldDecls(node: Node): IFieldDecl[] {
  const mods = modifiers(node);
  const base = {
    static: mods.includes('static') || mods.includes('const'),
    readonly: mods.includes('readonly') || mods.includes('const'),
    access: access(mods),
    attributes: attributes(node),
    doc: docComment(node),
  };
  if (node.type === 'property_declaration') {
    const type = fieldText(node, 'type');
    const accessors = field(node, 'accessors');
    const hasSetter =
      accessors !== null &&
      childrenOfType(accessors, 'accessor_declaration').some(a =>
        ['set', 'init'].includes(fieldText(a, 'name'))
      );
    return [
      {
        ...base,
        name: fieldText(node, 'name'),
        type,
        optional: type.endsWith('?'),
        readonly: base.readonly || (accessors !== null && !hasSetter),
      },
    ];
  }
  // field_declaration / event_field_declaration: one declaration can declare several names
  const decl = childrenOfType(node, 'variable_declaration')[0];
  if (!decl) return [];
  const type = fieldText(decl, 'type');
  return childrenOfType(decl, 'variable_declarator').map(v => ({
    ...base,
    name: fieldText(v, 'name') || (namedChildren(v)[0]?.text ?? ''),
    type,
    optional: type.endsWith('?'),
  }));
}

const TYPE_KINDS: Record<string, TypeKind> = {
  class_declaration: 'class',
  struct_declaration: 'struct',
  interface_declaration: 'interface',
  record_declaration: 'record',
  record_struct_declaration: 'record',
  enum_declaration: 'enum',
};

function readType(
  node: Node,
  kind: TypeKind,
  namespace: string | undefined
): ITypeDecl {
  const mods = modifiers(node);
  const t: ITypeDecl = {
    name: fieldText(node, 'name'),
    kind,
    namespace,
    exported: mods.includes('public'),
    bases: [],
    typeParams: [],
    fields: [],
    methods: [],
    members: [],
    attributes: attributes(node),
    doc: docComment(node),
    text: node.text,
    raw: node,
  };
  const baseList = childrenOfType(node, 'base_list')[0];
  if (baseList) t.bases = namedChildren(baseList).map(b => b.text);
  const tp = field(node, 'type_parameters');
  if (tp) t.typeParams = namedChildren(tp).map(p => p.text);

  if (kind === 'enum') {
    for (const m of childrenOfType(
      field(node, 'body') ?? node,
      'enum_member_declaration'
    )) {
      const value = fieldText(m, 'value');
      t.members.push({
        name: fieldText(m, 'name'),
        ...(value ? { value } : {}),
      });
    }
    return t;
  }
  // Positional record parameters are properties.
  for (const p of params(childrenOfType(node, 'parameter_list')[0] ?? null)) {
    t.fields.push({
      name: p.name,
      type: p.type,
      optional: p.optional,
      static: false,
      readonly: true,
      access: 'public',
      attributes: [],
    });
  }
  return t;
}

function walk(
  node: Node,
  out: SourceFileData,
  ctx: { namespace?: string; owner?: ITypeDecl }
): void {
  const owner = ctx.owner;
  let ns = ctx.namespace;
  for (const child of namedChildren(node)) {
    const kind = TYPE_KINDS[child.type];
    if (kind) {
      const t = readType(child, kind, ns);
      out.types.push(t);
      const body = field(child, 'body');
      if (body && kind !== 'enum') walk(body, out, { namespace: ns, owner: t });
      continue;
    }
    switch (child.type) {
      case 'file_scoped_namespace_declaration':
        ns = fieldText(child, 'name');
        out.namespaces.push(ns);
        break;
      case 'namespace_declaration': {
        const name = fieldText(child, 'name');
        const full = ns ? `${ns}.${name}` : name;
        out.namespaces.push(full);
        const body = field(child, 'body');
        if (body) walk(body, out, { namespace: full });
        break;
      }
      case 'method_declaration':
      case 'constructor_declaration':
      case 'operator_declaration':
        if (owner) owner.methods.push(method(child));
        break;
      case 'local_function_statement':
        out.functions.push(method(child));
        break;
      case 'field_declaration':
      case 'property_declaration':
      case 'event_field_declaration':
        if (owner) owner.fields.push(...fieldDecls(child));
        break;
      case 'delegate_declaration':
        out.types.push({
          ...readType(child, 'alias', ns),
          aliasOf: `${fieldText(child, 'type')}(${field(child, 'parameters')?.text ?? ''})`,
        });
        break;
    }
  }
}

export default defineSourceReader({
  id: 'csharp',
  extensions: ['.cs'],
  async read({ path, text }) {
    const root = await parse('csharp', text);
    const out: SourceFileData = {
      path,
      language: 'csharp',
      text,
      types: [],
      functions: [],
      namespaces: [],
      hasErrors: root.hasError,
    };
    walk(root, out, {});
    return out;
  },
});
