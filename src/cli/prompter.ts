import {
  checkbox,
  confirm,
  editor,
  input,
  number,
  search,
  select,
} from '@inquirer/prompts';
import { UserCancelledError } from '../core/errors.js';
import { listPathEntries, searchPathEntries } from './pathSearch.js';
import type { IPrompter } from '../core/ports.js';
import type {
  IChoice,
  IPathQuestion,
  ISearchQuestion,
  IWordsQuestion,
  Question,
} from '../core/types.js';

const MANUAL_ENTRY = '\0manual';

/** Where prompts read keys and draw. Defaults to the process's stdin and stdout. */
export interface IPromptStreams {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

type Context = Parameters<typeof input>[1];

/** Asks questions in the terminal with @inquirer/prompts. Ctrl-C throws UserCancelledError. */
export function createConsolePrompter(streams: IPromptStreams = {}): IPrompter {
  const context = { input: streams.input, output: streams.output } as Context;
  return {
    async ask(question) {
      try {
        return await ask(question, context);
      } catch (e) {
        if (e instanceof Error && e.name === 'ExitPromptError') {
          throw new UserCancelledError();
        }
        throw e;
      }
    },
  };
}

function toChoices(choices: IChoice[]): IChoice[] {
  return choices.map(c => ({ ...c, name: c.name ?? c.value }));
}

function ask(q: Question, ctx: Context): Promise<unknown> {
  const required = q.required === true;
  switch (q.type) {
    case undefined:
    case 'input':
      return input({ message: q.message, default: q.default, required }, ctx);
    case 'words':
      return askWords(q, ctx);
    case 'number':
      return number(
        {
          message: q.message,
          default: q.default,
          min: q.min,
          max: q.max,
          required,
        },
        ctx
      );
    case 'confirm':
      return confirm({ message: q.message, default: q.default }, ctx);
    case 'select':
      return select(
        {
          message: q.message,
          choices: toChoices(q.choices),
          default: q.default,
        },
        ctx
      );
    case 'search':
      return search(
        { message: q.message, source: searchSource(q), default: q.default },
        ctx
      );
    case 'path':
      return askPath(q, ctx);
    case 'checkbox':
      return checkbox(
        {
          message: q.message,
          required,
          choices: q.choices.map(c => ({
            ...c,
            name: c.name ?? c.value,
            checked: c.checked ?? q.default?.includes(c.value) ?? false,
          })),
        },
        ctx
      );
    case 'editor':
      return editor(
        { message: q.message, default: q.default, postfix: q.postfix },
        ctx
      );
  }
}

async function askWords(q: IWordsQuestion, ctx: Context): Promise<string[]> {
  const separator = q.separator;
  const raw = await input(
    {
      message: q.message,
      default: q.default?.join(separator ?? ' '),
      required: q.required === true,
    },
    ctx
  );
  return raw
    .trim()
    .split(separator ?? /\s+/)
    .map(w => w.trim())
    .filter(Boolean);
}

function searchSource(
  q: ISearchQuestion
): (term: string | undefined) => Promise<IChoice[]> {
  if (q.source) {
    const source = q.source;
    return async term => toChoices(await source(term));
  }
  const choices = toChoices(q.choices ?? []);
  return async term => {
    const words = term?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
    return choices.filter(c =>
      words.every(
        w =>
          c.value.toLowerCase().includes(w) || c.name?.toLowerCase().includes(w)
      )
    );
  };
}

async function askPath(q: IPathQuestion, ctx: Context): Promise<string> {
  const entries = await listPathEntries(q);
  const answer = await search(
    {
      message: q.message,
      default: q.default,
      source: async term => {
        const choices = searchPathEntries(term, entries).map(e => ({
          value: e.path,
          name: e.path,
        }));
        if (q.allowManualInput) {
          choices.push({
            value: MANUAL_ENTRY,
            name: '(enter a path manually)',
          });
        }
        return choices;
      },
    },
    ctx
  );
  if (answer !== MANUAL_ENTRY) return answer;
  return input(
    {
      message: 'Enter the path:',
      default: q.default,
      required: q.required === true,
    },
    ctx
  );
}
