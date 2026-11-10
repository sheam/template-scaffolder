import { ScaffolderError } from './errors.js';
import type { IPrompter, IReporter } from './ports.js';
import type { Answers, IChoice, Question } from './types.js';

/**
 * Ask each question in order, unless `when` skips it or a prior answer exists
 * (from --rerun or programmatic `answers`). Prior answers of `false`, `0` and `''` are kept.
 */
export async function collectAnswers(
  questions: Question[],
  deps: { prompter: IPrompter; reporter: IReporter; prior: Answers }
): Promise<Answers> {
  const answers: Answers = {};
  for (const question of questions) {
    if (question.when && !question.when(answers)) {
      deps.reporter.debug(`skipping question '${question.name}'`);
      continue;
    }
    if (Object.hasOwn(deps.prior, question.name)) {
      const prior = priorAnswer(question, deps.prior[question.name]);
      deps.reporter.info(`${question.message.trim()} ${formatAnswer(prior)}`);
      answers[question.name] = prior;
      continue;
    }
    answers[question.name] = await deps.prompter.ask(question);
  }
  return answers;
}

function formatAnswer(value: unknown): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  return String(value);
}

const TRUE = ['true', 'yes', 'y', '1'];
const FALSE = ['false', 'no', 'n', '0'];

/**
 * Check an answer given in advance (command line, `scaffold()`, or the last run) and
 * convert text to the question's type: `--answer WITH_TESTS=yes` becomes `true`.
 */
export function priorAnswer(question: Question, value: unknown): unknown {
  const invalid = (expected: string): never => {
    throw new ScaffolderError(
      'INVALID_ANSWER',
      `Invalid answer ${JSON.stringify(value)} for '${question.name}': expected ${expected}.`
    );
  };
  const text = typeof value === 'string' ? value.trim() : undefined;
  switch (question.type) {
    case 'confirm':
      if (typeof value === 'boolean') return value;
      if (text !== undefined && TRUE.includes(text.toLowerCase())) return true;
      if (text !== undefined && FALSE.includes(text.toLowerCase()))
        return false;
      return invalid('yes or no');
    case 'number': {
      const n = typeof value === 'number' ? value : text ? Number(text) : NaN;
      if (Number.isNaN(n)) return invalid('a number');
      if (
        (question.min !== undefined && n < question.min) ||
        (question.max !== undefined && n > question.max)
      ) {
        return invalid(
          `a number from ${question.min ?? '-∞'} to ${question.max ?? '∞'}`
        );
      }
      return n;
    }
    case 'words':
      if (Array.isArray(value)) return value;
      if (text === undefined) return invalid('a list of words');
      return text
        .split(question.separator ?? /\s+/)
        .map(w => w.trim())
        .filter(Boolean);
    case 'checkbox': {
      const values = Array.isArray(value)
        ? value
        : text !== undefined
          ? text
              .split(',')
              .map(v => v.trim())
              .filter(Boolean)
          : invalid('a list of values');
      const unknown = values.filter(v => !hasChoice(question.choices, v));
      if (unknown.length)
        return invalid(`some of ${choiceList(question.choices)}`);
      return values;
    }
    case 'select':
      return hasChoice(question.choices, value)
        ? value
        : invalid(`one of ${choiceList(question.choices)}`);
    case 'search':
      if (question.choices && !hasChoice(question.choices, value)) {
        return invalid(`one of ${choiceList(question.choices)}`);
      }
      return value;
    default:
      return value;
  }
}

function hasChoice(choices: IChoice[], value: unknown): boolean {
  return choices.some(c => c.value === value);
}

function choiceList(choices: IChoice[]): string {
  return choices.map(c => c.value).join(', ');
}
