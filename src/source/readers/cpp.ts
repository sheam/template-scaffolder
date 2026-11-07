import { defineSourceReader } from '../api.js';
import {
  blockBody,
  children,
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
} from '../types.js';

/**
 * Follow a declarator chain (pointer/reference/array/function wrappers) to the name,
 * collecting the pointer/reference suffix for the type and the function declarator if any.
 */
function unwrap(decl: Node | null): {
  name: string;
  suffix: string;
  fn: Node | null;
  default?: string;
} {
  let suffix = '';
  let fn: Node | null = null;
  let node = decl;
  while (node) {
    switch (node.type) {
      case 'pointer_declarator':
        suffix += '*';
        node = field(node, 'declarator') ?? namedChildren(node).at(-1) ?? null;
        continue;
      case 'reference_declarator':
        suffix += children(node)[0]?.type === '&&' ? '&&' : '&';
        node = namedChildren(node).at(-1) ?? null;
        continue;
      case 'array_declarator':
        suffix += '[]';
        node = field(node, 'declarator');
        continue;
      case 'function_declarator':
        fn ??= node;
        node = field(node, 'declarator');
        continue;
      case 'init_declarator':
        node = field(node, 'declarator');
        continue;
      default:
        return { name: node.text, suffix, fn };
    }
  }
  return { name: '', suffix, fn };
}

/** `const std::string` from the declaration's qualifiers + type. */
function baseTypeText(node: Node): string {
  const quals = childrenOfType(node, 'type_qualifier').map(q => q.text);
  return [...quals, fieldText(node, 'type')].filter(Boolean).join(' ');
}

function params(list: Node | null): IParamDecl[] {
  if (!list) return [];
  return namedChildren(list)
    .filter(
      p =>
        p.type === 'parameter_declaration' ||
        p.type === 'optional_parameter_declaration'
    )
    .map(p => {
      const { name, suffix } = unwrap(field(p, 'declarator'));
      const def = field(p, 'default_value');
      return {
        name,
        type: baseTypeText(p) + suffix,
        optional: def !== null,
        ...(def ? { default: def.text } : {}),
      };
    });
}

function storage(node: Node): string[] {
  return childrenOfType(node, 'storage_class_specifier').map(s => s.text);
}

function func(node: Node, access?: Access): IFunctionDecl | null {
  const { name, suffix, fn } = unwrap(field(node, 'declarator'));
  if (!fn) return null;
  const body = field(node, 'body');
  const returnType = fieldText(node, 'type') ? baseTypeText(node) + suffix : '';
  return {
    name,
    params: params(field(fn, 'parameters')),
    returnType,
    async: false,
    static: storage(node).includes('static'),
    access,
    attributes: childrenOfType(node, 'attribute_declaration').map(a => a.text),
    doc: docComment(node),
    bodyText: blockBody(body),
    text: node.text,
    raw: node,
  };
}

function readRecord(
  node: Node,
  kind: 'class' | 'struct',
  ctx: IWalkCtx
): ITypeDecl {
  const template = ctx.template ?? null;
  const t: ITypeDecl = {
    name: fieldText(node, 'name'),
    kind,
    namespace: ctx.namespace,
    exported: true,
    bases: [],
    typeParams: template
      ? namedChildren(field(template, 'parameters') ?? template).map(
          p => p.text
        )
      : [],
    fields: [],
    methods: [],
    members: [],
    attributes: [],
    doc: docComment(template ?? node),
    text: (template ?? node).text,
    raw: node,
  };
  const bases = childrenOfType(node, 'base_class_clause')[0];
  if (bases) {
    t.bases = namedChildren(bases)
      .filter(b => b.type !== 'access_specifier')
      .map(b => b.text);
  }
  let access: Access = kind === 'class' ? 'private' : 'public';
  for (const m of namedChildren(field(node, 'body') ?? node)) {
    switch (m.type) {
      case 'access_specifier':
        access = m.text.replace(':', '').trim() as Access;
        break;
      case 'field_declaration':
      case 'declaration':
      case 'function_definition': {
        const f = func(m, access);
        if (f) {
          // Constructors and destructors have no return type; keep them as methods anyway.
          t.methods.push(f);
          break;
        }
        if (m.type === 'function_definition') break;
        // `int x, y;` has one declarator per name.
        for (const d of m
          .childrenForFieldName('declarator')
          .filter((c): c is Node => c !== null)) {
          const { name, suffix } = unwrap(d);
          t.fields.push({
            name,
            type: baseTypeText(m) + suffix,
            optional: false,
            static: storage(m).includes('static'),
            readonly: childrenOfType(m, 'type_qualifier').some(
              q => q.text === 'const'
            ),
            access,
            attributes: [],
            doc: docComment(m),
          } satisfies IFieldDecl);
        }
        break;
      }
      case 'template_declaration':
        for (const inner of namedChildren(m)) {
          if (
            inner.type === 'function_definition' ||
            inner.type === 'declaration'
          ) {
            const f = func(inner, access);
            if (f) t.methods.push({ ...f, text: m.text });
          }
        }
        break;
    }
  }
  return t;
}

function readEnum(node: Node, ctx: IWalkCtx): ITypeDecl {
  const members = childrenOfType(field(node, 'body') ?? node, 'enumerator').map(
    e => {
      const value = fieldText(e, 'value');
      return { name: fieldText(e, 'name'), ...(value ? { value } : {}) };
    }
  );
  const base = fieldText(node, 'base');
  return {
    name: fieldText(node, 'name'),
    kind: 'enum',
    namespace: ctx.namespace,
    exported: true,
    bases: base ? [base] : [],
    typeParams: [],
    fields: [],
    methods: [],
    members,
    attributes: [],
    doc: docComment(node),
    text: node.text,
    raw: node,
  };
}

interface IWalkCtx {
  namespace?: string;
  /** The enclosing template_declaration, if any. */
  template?: Node | null;
}

function visitTypeSpecifier(
  node: Node,
  out: SourceFileData,
  ctx: IWalkCtx
): boolean {
  if (!field(node, 'body')) return false; // forward declaration or use
  if (
    node.type === 'class_specifier' ||
    node.type === 'struct_specifier' ||
    node.type === 'union_specifier'
  ) {
    out.types.push(
      readRecord(
        node,
        node.type === 'class_specifier' ? 'class' : 'struct',
        ctx
      )
    );
    return true;
  }
  if (node.type === 'enum_specifier') {
    out.types.push(readEnum(node, ctx));
    return true;
  }
  return false;
}

function walk(node: Node, out: SourceFileData, ctx: IWalkCtx): void {
  for (const child of namedChildren(node)) {
    switch (child.type) {
      case 'namespace_definition': {
        const name = fieldText(child, 'name');
        const namespace = name
          ? ctx.namespace
            ? `${ctx.namespace}::${name}`
            : name
          : ctx.namespace;
        if (namespace && !out.namespaces.includes(namespace))
          out.namespaces.push(namespace);
        const body = field(child, 'body');
        if (body) walk(body, out, { namespace });
        break;
      }
      case 'linkage_specification': {
        const body = field(child, 'body');
        if (body)
          walk(body.type === 'declaration_list' ? body : child, out, ctx);
        break;
      }
      case 'class_specifier':
      case 'struct_specifier':
      case 'union_specifier':
      case 'enum_specifier':
        visitTypeSpecifier(child, out, ctx);
        break;
      case 'template_declaration':
        for (const inner of namedChildren(child)) {
          if (visitTypeSpecifier(inner, out, { ...ctx, template: child }))
            break;
          if (
            inner.type === 'function_definition' ||
            inner.type === 'declaration'
          ) {
            const f = func(inner);
            if (f) out.functions.push({ ...f, text: child.text });
          }
        }
        break;
      case 'type_definition':
      case 'alias_declaration': {
        const typeNode = field(child, 'type');
        if (typeNode && visitTypeSpecifier(typeNode, out, ctx)) break;
        const name =
          child.type === 'alias_declaration'
            ? fieldText(child, 'name')
            : unwrap(field(child, 'declarator')).name;
        out.types.push({
          name,
          kind: 'alias',
          namespace: ctx.namespace,
          exported: true,
          bases: [],
          typeParams: [],
          fields: [],
          methods: [],
          members: [],
          aliasOf: typeNode?.text ?? '',
          attributes: [],
          doc: docComment(child),
          text: child.text,
          raw: child,
        });
        break;
      }
      case 'declaration':
      case 'function_definition': {
        const typeNode = field(child, 'type');
        if (typeNode && visitTypeSpecifier(typeNode, out, ctx)) break;
        const f = func(child);
        if (f) out.functions.push(f);
        break;
      }
      case 'preproc_ifdef':
      case 'preproc_if':
      case 'preproc_else':
      case 'preproc_elif':
        // Read both branches of #if blocks: headers often wrap everything in include guards.
        walk(child, out, ctx);
        break;
    }
  }
}

export default defineSourceReader({
  id: 'cpp',
  extensions: [
    '.h',
    '.hpp',
    '.hh',
    '.hxx',
    '.cpp',
    '.cc',
    '.cxx',
    '.c++',
    '.ipp',
  ],
  async read({ path, text }) {
    const root = await parse('cpp', text);
    const out: SourceFileData = {
      path,
      language: 'cpp',
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
