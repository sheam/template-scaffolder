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

export function isConfirmQuestion(q: IQuestionBase): q is IConfirmQuestion {
  return (q as IConfirmQuestion).type === 'confirm';
}

export function isInputQuestion(q: IQuestionBase): q is IInputQuestion {
  return (
    (q as IInputQuestion).type === 'input' ||
    (q as IInputQuestion).type === undefined
  );
}

export function isNumberQuestion(q: IQuestionBase): q is INumberQuestion {
  return (q as INumberQuestion).type === 'number';
}

export function isSearchQuestion(q: IQuestionBase): q is ISearchQuestion {
  const x = q as ISearchQuestion;
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

export function isSelectQuestion(q: IQuestionBase): q is ISelectQuestion {
  const x = q as ISelectQuestion;
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

export function isPathSelectQuestion(
  q: IQuestionBase
): q is IPathSelectQuestion {
  const x = q as IPathSelectQuestion;
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
