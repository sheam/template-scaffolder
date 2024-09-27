/* eslint-disable max-lines */
import { logError } from './util';

export type TemplateVariables = {
  [key: string]: string | number;
};

export type PatternList = Array<string | RegExp> | undefined;

export interface IConfigFile {
  name?: string;
  description?: string;
  version?: string;
  variables?:
    | object
    | ((instanceName: string, initialInputs: object) => object);
  prompts?: Question[] | ((instanceName: string) => Question[]);
  stripLines?: PatternList;
  macros?: object;
  destinations?: Array<string> | string;
  createNameDir?: boolean;
  srcRoot?: string;
  afterFileCreated?: (
    createdFilePath: string,
    dryRun: boolean,
    variablesHash: TemplateVariables
  ) => Promise<string[]>;
}

export interface ITemplateDescriptor {
  name: string;
  dir: string;
  description?: string;
}

export interface IFinalizedInputs {
  instanceName: string;
  template: ITemplateDescriptor;
  destination: string;
  overwrite: boolean;
  variables: TemplateVariables;
  srcRoot: string;
  afterFileCreated: IConfigFile['afterFileCreated'];
  stripLines: Array<string | RegExp> | undefined;
  createNameDir: boolean;
  macros: object;
}

export interface ICliArgs {
  template?: string;
  name?: string;
  destination?: string;
  dryRun?: boolean;
  overwrite?: boolean;
}

export interface IInitialInputs {
  instanceName: string;
  template: ITemplateDescriptor;
}

export interface IChoice {
  value: string;
  name?: string;
  description?: string;
  disabled?: boolean;
}

export interface IPathInfo {
  path: string;
  name: string;
  isDir: boolean;
}

interface IQuestionBase {
  type?:
    | 'path'
    | 'select'
    | 'search'
    | 'confirm'
    | 'number'
    | 'input'
    | undefined;

  /**
   * The name of the field to store the resulting answer in.
   */
  name: string;

  /**
   * The message prompting the user.
   */
  message: string;

  /**
   * The default value for the answer.
   */
  default?: string | number | boolean;

  /**
   * True if the user must enter a value for the question.
   */
  required?: boolean;

  /**
   * Can we skip answering this question?
   * You can examine the previous answers and determine if you would like to answer this questions.
   * If the question is skipped, the answer value will be undefined.
   * @param previousAnswers
   * @return false if the question should be skipped.
   */
  when?: <TAnswerObject extends object>(
    previousAnswers: TAnswerObject
  ) => boolean;
}

interface IConfirmQuestion extends IQuestionBase {
  type: 'confirm';
  default?: boolean;
}

export function isConfirmQuestion(q: IQuestionBase): q is IConfirmQuestion {
  return (q as IConfirmQuestion).type === 'confirm';
}

interface IInputQuestion extends IQuestionBase {
  type?: 'input';
  default?: string;
}

export function isInputQuestion(q: IQuestionBase): q is IInputQuestion {
  return (
    (q as IInputQuestion).type === 'input' ||
    (q as IInputQuestion).type === undefined
  );
}

interface INumberQuestion extends IQuestionBase {
  type: 'number';
  default?: number;
}

export function isNumberQuestion(q: IQuestionBase): q is INumberQuestion {
  return (q as INumberQuestion).type === 'number';
}

export interface ISearchQuestion extends IQuestionBase {
  type: 'search';
  source?: (input: string | undefined) => Promise<IChoice[]>;
  choices?: IChoice[];
  default?: string;
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

interface ISelectQuestion extends IQuestionBase {
  type: 'select';
  choices: IChoice[];
  default?: string;
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

export interface IPathSelectQuestion extends IQuestionBase {
  type: 'path';
  itemType?: 'file' | 'directory';
  allowManualInput?: boolean;
  rootPath?: string;
  maxDepth?: number;
  excludePath?: (pathInfo: IPathInfo) => boolean;
  default?: string;
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

export type Question =
  | ISelectQuestion
  | IInputQuestion
  | INumberQuestion
  | ISearchQuestion
  | IConfirmQuestion
  | IPathSelectQuestion;
