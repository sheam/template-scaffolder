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

/** Asks questions in the terminal with @inquirer/prompts. Ctrl-C throws UserCancelledError. */
export function createConsolePrompter(): IPrompter {
  return {
    async ask(question) {
      try {
        return await ask(question);
      } catch (e) {
        if (e instanceof Error && e.name === 'ExitPromptError')
          throw new UserCancelledError();
        throw e;
      }
    },
  };
}

function toChoices(choices: IChoice[]): IChoice[] {
  return choices.map(c => ({ ...c, name: c.name ?? c.value }));
}

function ask(q: Question): Promise<unknown> {
  const required = q.required === true;
  switch (q.type) {
    case undefined:
    case 'input':
      return input({ message: q.message, default: q.default, required });
    case 'words':
      return askWords(q);
    case 'number':
      return number({
        message: q.message,
        default: q.default,
        min: q.min,
        max: q.max,
        required,
      });
    case 'confirm':
      return confirm({ message: q.message, default: q.default });
    case 'select':
      return select({
        message: q.message,
        choices: toChoices(q.choices),
        default: q.default,
      });
    case 'search':
      return search({
        message: q.message,
        source: searchSource(q),
        default: q.default,
      });
    case 'path':
      return askPath(q);
    case 'checkbox':
      return checkbox({
        message: q.message,
        required,
        choices: q.choices.map(c => ({
          ...c,
          name: c.name ?? c.value,
          checked: c.checked ?? q.default?.includes(c.value) ?? false,
        })),
      });
    case 'editor':
      return editor({
        message: q.message,
        default: q.default,
        postfix: q.postfix,
      });
  }
}

async function askWords(q: IWordsQuestion): Promise<string[]> {
  const separator = q.separator;
  const raw = await input({
    message: q.message,
    default: q.default?.join(separator ?? ' '),
    required: q.required === true,
  });
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

async function askPath(q: IPathQuestion): Promise<string> {
  const entries = await listPathEntries(q);
  const answer = await search({
    message: q.message,
    default: q.default,
    source: async term => {
      const choices = searchPathEntries(term, entries).map(e => ({
        value: e.path,
        name: e.path,
      }));
      if (q.allowManualInput)
        choices.push({ value: MANUAL_ENTRY, name: '(enter a path manually)' });
      return choices;
    },
  });
  if (answer !== MANUAL_ENTRY) return answer;
  return input({
    message: 'Enter the path:',
    default: q.default,
    required: q.required === true,
  });
}
