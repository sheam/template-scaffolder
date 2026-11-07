import { ScaffolderError } from './errors.js';
import type { Question, QuestionType } from './types.js';

const QUESTION_TYPES: QuestionType[] = [
  'input',
  'words',
  'number',
  'confirm',
  'select',
  'search',
  'path',
  'checkbox',
  'editor',
];

/** 2.x names that still work, with a warning. */
const LEGACY_TYPES: Record<string, QuestionType> = {
  list: 'select',
  fuzzypath: 'path',
};

export interface IValidatedQuestions {
  questions: Question[];
  warnings: string[];
}

/**
 * Validate questions from a config and return normalized copies.
 * Never mutates the config's objects. Throws one CONFIG_INVALID error listing every problem.
 */
export function validateQuestions(
  input: unknown,
  templateName: string
): IValidatedQuestions {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(input)) {
    throw new ScaffolderError(
      'CONFIG_INVALID',
      `'prompts' in template '${templateName}' must be an array of questions (or a function returning one).`
    );
  }

  const seen = new Set<string>();
  const questions = input.map((raw, index): Question => {
    const where = `prompts[${index}]`;
    if (!raw || typeof raw !== 'object') {
      errors.push(`${where} must be an object.`);
      return raw as Question;
    }
    const q = { ...(raw as Record<string, unknown>) };
    const label = typeof q.name === 'string' ? `${where} '${q.name}'` : where;

    if (typeof q.name !== 'string' || !q.name) {
      errors.push(`${where} needs a non-empty 'name'.`);
    } else if (seen.has(q.name)) {
      errors.push(`${label}: the name is used by more than one question.`);
    } else {
      seen.add(q.name);
    }
    if (typeof q.message !== 'string') {
      errors.push(`${label} needs a 'message'.`);
    }

    if (q.type === undefined) q.type = 'input';
    if (typeof q.type === 'string' && q.type in LEGACY_TYPES) {
      warnings.push(
        `${label}: type '${q.type}' is deprecated, use '${LEGACY_TYPES[q.type]}'.`
      );
      q.type = LEGACY_TYPES[q.type];
    }
    if (!QUESTION_TYPES.includes(q.type as QuestionType)) {
      errors.push(
        `${label}: unknown type '${String(q.type)}'. Expected one of ${QUESTION_TYPES.join(', ')}.`
      );
    }
    if ('maxDepth' in q && !('depthLimit' in q)) {
      warnings.push(`${label}: 'maxDepth' is not supported, use 'depthLimit'.`);
      q.depthLimit = q.maxDepth;
      delete q.maxDepth;
    }
    if (q.when !== undefined && typeof q.when !== 'function') {
      errors.push(`${label}: 'when' must be a function.`);
    }

    switch (q.type) {
      case 'select':
      case 'checkbox':
        if (!Array.isArray(q.choices)) {
          errors.push(
            `${label}: a ${q.type} question needs a 'choices' array.`
          );
        }
        break;
      case 'search': {
        const hasChoices = Array.isArray(q.choices);
        const hasSource = typeof q.source === 'function';
        if (hasChoices === hasSource) {
          errors.push(
            `${label}: a search question needs either 'choices' or 'source', but not both.`
          );
        }
        break;
      }
      case 'path':
        if (
          q.excludePath !== undefined &&
          typeof q.excludePath !== 'function'
        ) {
          errors.push(`${label}: 'excludePath' must be a function.`);
        }
        break;
    }
    return q as unknown as Question;
  });

  if (errors.length) {
    throw new ScaffolderError(
      'CONFIG_INVALID',
      `Invalid prompts in template '${templateName}':`,
      { details: errors }
    );
  }
  return { questions, warnings };
}
