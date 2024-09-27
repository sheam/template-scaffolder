import { logError } from '../util.js';
import {
  IConfirmQuestion,
  IInputQuestion,
  INumberQuestion,
  IPathSelectQuestion,
  IQuestionBase,
  ISearchQuestion,
  ISelectQuestion,
} from './index.js';

export function isConfirmQuestion<TInput extends object>(
  q: IQuestionBase<TInput>
): q is IConfirmQuestion<TInput> {
  return (q as IConfirmQuestion<TInput>).type === 'confirm';
}

export function isInputQuestion<TInput extends object>(
  q: IQuestionBase<TInput>
): q is IInputQuestion<TInput> {
  return (
    (q as IInputQuestion<TInput>).type === 'input' ||
    (q as IInputQuestion<TInput>).type === undefined
  );
}

export function isNumberQuestion<TInput extends object>(
  q: IQuestionBase<TInput>
): q is INumberQuestion<TInput> {
  return (q as INumberQuestion<TInput>).type === 'number';
}

export function isSearchQuestion<TInput extends object>(
  q: IQuestionBase<TInput>
): q is ISearchQuestion<TInput> {
  const x = q as ISearchQuestion<TInput>;
  if (x.type !== 'search') {
    return false;
  }
  if ((!x.source && !x.choices) || (x.source && x.choices)) {
    logError(
      `Search question '${q.message}' must either 'source' or 'choices', but not both.`
    );
    return false;
  }
  return true;
}

export function isSelectQuestion<TInput extends object>(
  q: IQuestionBase<TInput>
): q is ISelectQuestion<TInput> {
  const x = q as ISelectQuestion<TInput>;
  if (x.type !== 'select' && x.type !== 'list') {
    return false;
  }
  if (!Array.isArray(x.choices)) {
    logError(
      `SelectQuestion '${q.message}' must have a 'choices' property with a list of options.`
    );
    return false;
  }
  return true;
}

export function isPathSelectQuestion<TInput extends object>(
  q: IQuestionBase<TInput>
): q is IPathSelectQuestion<TInput> {
  const x = q as IPathSelectQuestion<TInput>;
  if (x.type !== 'path' && x.type !== 'fuzzypath') {
    return false;
  }
  if (x.excludePath && typeof x.excludePath !== 'function') {
    logError(
      `The 'excludePath' of PathSelectQuestion for question '${q.message}' is not a function`
    );
    return false;
  }
  return true;
}
