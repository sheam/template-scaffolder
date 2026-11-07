import { defineSourceReader } from '../api.js';
import {
  blockBody,
  childrenOfType,
  docComment,
  field,
  fieldText,
  hasToken,
  type Node,
  namedChildren,
  parse,
} from '../treeSitter.js';
import type {
  Access,
  IEnumMember,
  IFieldDecl,
  IFunctionDecl,
  IParamDecl,
  ITypeDecl,
  SourceFileData,
} from '../types.js';

/** `: Foo` -> `Foo` */
function annotation(node: Node | null): string {
  if (!node) return '';
  return node.type === 'type_annotation'
    ? (namedChildren(node)[0]?.text ?? '')
    : node.text;
}

function params(node: Node | null): IParamDecl[] {
  if (!node) return [];
  return namedChildren(node)
    .filter(
      p => p.type === 'required_parameter' || p.type === 'optional_parameter'
    )
    .map(p => {
      const value = field(p, 'value');
      return {
        name: fieldText(p, 'pattern'),
        type: annotation(field(p, 'type')),
        optional: p.type === 'optional_parameter' || value !== null,
        ...(value ? { default: value.text } : {}),
      };
    });
}

function access(node: Node): Access | undefined {
  const mod = childrenOfType(node, 'accessibility_modifier')[0];
  return mod ? (mod.text as Access) : undefined;
}

function func(node: Node, nameOverride?: string): IFunctionDecl {
  const body = field(node, 'body');
  return {
    name: nameOverride ?? fieldText(node, 'name'),
    params: params(field(node, 'parameters')),
    returnType: annotation(field(node, 'return_type')),
    async: hasToken(node, 'async'),
    static: hasToken(node, 'static'),
    access: access(node),
    attributes: childrenOfType(node, 'decorator').map(d =>
      d.text.replace(/^@/, '')
    ),
    doc: docComment(node),
    bodyText: body?.type === 'statement_block' ? blockBody(body) : body?.text,
    text: node.text,
    raw: node,
  };
}

function member(node: Node): IFieldDecl {
  return {
    name: fieldText(node, 'name'),
    type: annotation(field(node, 'type')),
    optional: hasToken(node, '?'),
    static: hasToken(node, 'static'),
    readonly: hasToken(node, 'readonly'),
    access: access(node),
    attributes: childrenOfType(node, 'decorator').map(d =>
      d.text.replace(/^@/, '')
    ),
    doc: docComment(node),
  };
}

function typeParams(node: Node): string[] {
  const tp = field(node, 'type_parameters');
  return tp ? namedChildren(tp).map(p => p.text) : [];
}

function baseType(
  node: Node,
  kind: ITypeDecl['kind'],
  ctx: { namespace?: string; exported: boolean; docNode: Node }
): ITypeDecl {
  return {
    name: fieldText(node, 'name'),
    kind,
    namespace: ctx.namespace,
    exported: ctx.exported,
    bases: [],
    typeParams: typeParams(node),
    fields: [],
    methods: [],
    members: [],
    attributes: [],
    doc: docComment(ctx.docNode),
    text: node.text,
    raw: node,
  };
}

function readInterface(node: Node, t: ITypeDecl): ITypeDecl {
  const ext = childrenOfType(node, 'extends_type_clause')[0];
  if (ext) t.bases = namedChildren(ext).map(b => b.text);
  for (const m of namedChildren(field(node, 'body') ?? node)) {
    if (m.type === 'property_signature') t.fields.push(member(m));
    else if (m.type === 'method_signature') t.methods.push(func(m));
  }
  return t;
}

function readClass(node: Node, t: ITypeDecl): ITypeDecl {
  const heritage = childrenOfType(node, 'class_heritage')[0];
  if (heritage) {
    for (const clause of namedChildren(heritage)) {
      t.bases.push(...namedChildren(clause).map(b => b.text));
    }
  }
  t.attributes = childrenOfType(node, 'decorator').map(d =>
    d.text.replace(/^@/, '')
  );
  for (const m of namedChildren(field(node, 'body') ?? node)) {
    if (m.type === 'public_field_definition') t.fields.push(member(m));
    else if (
      m.type === 'method_definition' ||
      m.type === 'abstract_method_signature'
    ) {
      t.methods.push(func(m));
    }
  }
  return t;
}

function readEnum(node: Node, t: ITypeDecl): ITypeDecl {
  for (const m of namedChildren(field(node, 'body') ?? node)) {
    if (m.type === 'enum_assignment') {
      t.members.push({
        name: fieldText(m, 'name'),
        value: fieldText(m, 'value'),
      });
    } else if (m.type === 'property_identifier' || m.type === 'string') {
      t.members.push({
        name: m.text.replace(/^['"]|['"]$/g, ''),
      } satisfies IEnumMember);
    }
  }
  return t;
}

interface IWalkCtx {
  namespace?: string;
  exported: boolean;
  docNode?: Node;
}

function walk(node: Node, out: SourceFileData, ctx: IWalkCtx): void {
  for (const child of namedChildren(node)) {
    visit(child, out, ctx);
  }
}

function visit(node: Node, out: SourceFileData, ctx: IWalkCtx): void {
  const typeCtx = {
    namespace: ctx.namespace,
    exported: ctx.exported,
    docNode: ctx.docNode ?? node,
  };
  switch (node.type) {
    case 'export_statement': {
      const decl = field(node, 'declaration');
      if (decl) visit(decl, out, { ...ctx, exported: true, docNode: node });
      return;
    }
    case 'ambient_declaration':
    case 'expression_statement':
      walk(node, out, { ...ctx, docNode: ctx.docNode ?? node });
      return;
    case 'internal_module':
    case 'module': {
      const name = fieldText(node, 'name').replace(/^['"]|['"]$/g, '');
      const namespace = ctx.namespace ? `${ctx.namespace}.${name}` : name;
      if (!out.namespaces.includes(namespace)) out.namespaces.push(namespace);
      const body = field(node, 'body');
      if (body) walk(body, out, { namespace, exported: false });
      return;
    }
    case 'interface_declaration':
      out.types.push(readInterface(node, baseType(node, 'interface', typeCtx)));
      return;
    case 'class_declaration':
    case 'abstract_class_declaration':
      out.types.push(readClass(node, baseType(node, 'class', typeCtx)));
      return;
    case 'enum_declaration':
      out.types.push(readEnum(node, baseType(node, 'enum', typeCtx)));
      return;
    case 'type_alias_declaration': {
      const value = field(node, 'value');
      const t = baseType(
        node,
        value?.type === 'union_type' ? 'union' : 'alias',
        typeCtx
      );
      t.aliasOf = value?.text;
      out.types.push(t);
      return;
    }
    case 'function_declaration':
    case 'generator_function_declaration':
    case 'function_signature':
      out.functions.push({
        ...func(node),
        doc: docComment(ctx.docNode ?? node),
      });
      return;
    case 'lexical_declaration':
    case 'variable_declaration':
      for (const decl of childrenOfType(node, 'variable_declarator')) {
        const value = field(decl, 'value');
        if (
          value &&
          (value.type === 'arrow_function' ||
            value.type === 'function_expression')
        ) {
          out.functions.push({
            ...func(value, fieldText(decl, 'name')),
            doc: docComment(ctx.docNode ?? node),
            text: node.text,
          });
        }
      }
      return;
  }
}

export default defineSourceReader({
  id: 'typescript',
  extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
  async read({ path, text }) {
    const grammar = /\.[jt]sx$/i.test(path) ? 'tsx' : 'typescript';
    const root = await parse(grammar, text);
    const out: SourceFileData = {
      path,
      language: 'typescript',
      text,
      types: [],
      functions: [],
      namespaces: [],
      hasErrors: root.hasError,
    };
    walk(root, out, { exported: false });
    return out;
  },
});
