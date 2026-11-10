/**
 * Public types for template authors and programmatic users.
 * Everything here is re-exported from the package root.
 */
import type { ISourceApi, ISourceReader } from '../source/types.js';

export type TemplateVariables = Record<string, unknown>;

// Macros are called from Velocity templates with arbitrary arguments.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MacroFunction = (...args: any[]) => unknown;
export type MacroObject = Record<string, MacroFunction>;

export type PatternList = Array<string | RegExp>;

/** Answers collected from prompts, keyed by question name. */
export type Answers = Record<string, unknown>;

/** Variables that are always available to templates. */
export interface IBuiltIns {
  /** The instance name entered by the user (or `--name`). */
  NAME: string;
  TEMPLATE_NAME: string;
  TEMPLATE_VERSION: string;
  /** git user.name, then git user.email, then the USERNAME/USER environment variable. */
  USERNAME: string;
}

/** Passed to `prompts()` when prompts is a function. */
export interface IPromptsContext {
  /** The instance name entered by the user. */
  name: string;
  builtins: IBuiltIns;
  /** Read declarations from TypeScript, C#, C++ (or custom) source files. */
  source: ISourceApi;
}

/** Passed to `variables()` and `hooks.beforeRun()`. */
export interface IVariablesContext<
  TAnswers extends object = Answers,
> extends IPromptsContext {
  answers: TAnswers;
}

/** Passed to `macros()` when macros is a function. */
export interface IMacrosContext<
  TAnswers extends object = Answers,
> extends IVariablesContext<TAnswers> {
  /** The final variables: built-ins, answers, and the result of `variables()`. */
  variables: TemplateVariables;
}

/** Passed to every hook. */
export interface IHookContext<
  TAnswers extends object = Answers,
> extends IVariablesContext<TAnswers> {
  /** The destination directory, relative to the project root. */
  destination: string;
  dryRun: boolean;
}

/** Passed to `hooks.afterFileCreated()`. */
export interface IFileHookContext<
  TAnswers extends object = Answers,
> extends IHookContext<TAnswers> {
  /** Path of the generated file, relative to the project root, using forward slashes. */
  path: string;
  /** Every variable the templates saw. */
  variables: TemplateVariables;
}

/** Passed to `hooks.afterRun()`. */
export interface IRunHookContext<
  TAnswers extends object = Answers,
> extends IHookContext<TAnswers> {
  /** Every file the run produced, including skipped and failed ones. */
  files: IFileResult[];
  /** Paths of files that were created or overwritten (or would be, in a dry run). */
  createdPaths: string[];
  /** Every variable the templates saw. */
  variables: TemplateVariables;
}

/** Shell commands a hook asks the scaffolder to run. Nothing to run: return nothing. */
export type HookCommands = string[] | null | undefined | void;

export interface IHooks<TAnswers extends object = Answers> {
  /** Runs once after prompts are answered and before any file is generated. Throw to stop the run. */
  beforeRun?: (ctx: IHookContext<TAnswers>) => void | Promise<void>;
  /** Runs after each file is generated. Returned commands are run (not in a dry run). */
  afterFileCreated?: (
    ctx: IFileHookContext<TAnswers>
  ) => HookCommands | Promise<HookCommands>;
  /** Runs once after all files are generated. Returned commands are run (not in a dry run). */
  afterRun?: (
    ctx: IRunHookContext<TAnswers>
  ) => HookCommands | Promise<HookCommands>;
}

type ValueOrFactory<TValue, TContext> =
  TValue | ((ctx: TContext) => TValue | Promise<TValue>);

/**
 * The default export of a `scaffolding.config.{ts,mts,cts,js,mjs,cjs}` file.
 * All fields are optional.
 */
export interface IConfigFile<TAnswers extends object = Answers> {
  name?: string;
  description?: string;
  version?: string;
  prompts?: ValueOrFactory<Question<TAnswers>[], IPromptsContext>;
  variables?: ValueOrFactory<TemplateVariables, IVariablesContext<TAnswers>>;
  macros?: ValueOrFactory<MacroObject, IMacrosContext<TAnswers>>;
  /** A fixed destination directory; the user is not asked. */
  destination?: string;
  /** Destination directories offered in a list, with an "Other" option. */
  destinations?: string[];
  /** Create a directory named after the instance name inside the destination. Default true. */
  createNameDir?: boolean;
  /** Root for the destination directory picker. Default `./src` if it exists, else the project root. */
  srcRoot?: string;
  /** Lines matching any pattern are removed before rendering. Strings match the start of the trimmed line. */
  stripLines?: PatternList;
  /**
   * Glob patterns (relative to the template folder) for files that are not templates.
   * Patterns without a `/` match file names at any depth. `scaffolding.config.*` is always ignored.
   */
  ignore?: string[];
  hooks?: IHooks<TAnswers>;
  /** Extra source readers, e.g. for languages without a built-in reader. */
  readers?: ISourceReader[];
  /**
   * Fail a file that uses a variable that does not exist, instead of warning.
   * Velocity outputs an unknown `$NAME` as written. Default false.
   */
  strictVariables?: boolean;
  /**
   * Keep the line break after a directive or macro call that ends a line of text
   * (`// #upperFirst($NAME)`). Velocity removes it by default. Default false.
   */
  keepLineBreaks?: boolean;
}

export interface IChoice {
  value: string;
  name?: string;
  description?: string;
  disabled?: boolean;
}

export interface ICheckboxChoice extends IChoice {
  checked?: boolean;
}

export interface IPathInfo {
  /** Path using forward slashes. */
  path: string;
  name: string;
  isDir: boolean;
}

export type QuestionType =
  | 'input'
  | 'words'
  | 'number'
  | 'confirm'
  | 'select'
  | 'search'
  | 'path'
  | 'checkbox'
  | 'editor';

export interface IQuestionBase<TAnswers extends object = Answers> {
  type?: QuestionType;
  /** The answer is stored in a variable with this name. */
  name: Extract<keyof TAnswers, string> | (string & NonNullable<unknown>);
  message: string;
  required?: boolean;
  /**
   * Return false to skip this question. Skipped questions have an undefined answer.
   * @param answers the answers given so far.
   */
  when?: (answers: Partial<TAnswers>) => boolean;
}

export interface IInputQuestion<
  TAnswers extends object = Answers,
> extends IQuestionBase<TAnswers> {
  type?: 'input';
  default?: string;
}

/** Free text split into a list of words. */
export interface IWordsQuestion<
  TAnswers extends object = Answers,
> extends IQuestionBase<TAnswers> {
  type: 'words';
  /** Defaults to any whitespace. */
  separator?: string;
  default?: string[];
}

export interface INumberQuestion<
  TAnswers extends object = Answers,
> extends IQuestionBase<TAnswers> {
  type: 'number';
  default?: number;
  min?: number;
  max?: number;
}

export interface IConfirmQuestion<
  TAnswers extends object = Answers,
> extends IQuestionBase<TAnswers> {
  type: 'confirm';
  default?: boolean;
}

export interface ISelectQuestion<
  TAnswers extends object = Answers,
> extends IQuestionBase<TAnswers> {
  type: 'select';
  choices: IChoice[];
  default?: string;
}

/** Type to filter a list. Supply exactly one of `choices` or `source`. */
export interface ISearchQuestion<
  TAnswers extends object = Answers,
> extends IQuestionBase<TAnswers> {
  type: 'search';
  choices?: IChoice[];
  source?: (input: string | undefined) => IChoice[] | Promise<IChoice[]>;
  default?: string;
}

/** Fuzzy-search for a file or directory. */
export interface IPathQuestion<
  TAnswers extends object = Answers,
> extends IQuestionBase<TAnswers> {
  type: 'path';
  itemType?: 'file' | 'directory';
  allowManualInput?: boolean;
  /** Defaults to the project root. */
  rootPath?: string;
  /** How many directory levels below rootPath to list. Unlimited by default. */
  depthLimit?: number;
  excludePath?: (pathInfo: IPathInfo) => boolean;
  default?: string;
}

/** Pick any number of options; the answer is a string array. */
export interface ICheckboxQuestion<
  TAnswers extends object = Answers,
> extends IQuestionBase<TAnswers> {
  type: 'checkbox';
  choices: ICheckboxChoice[];
  default?: string[];
}

/** Multi-line text in the user's $EDITOR. */
export interface IEditorQuestion<
  TAnswers extends object = Answers,
> extends IQuestionBase<TAnswers> {
  type: 'editor';
  default?: string;
  /** File extension for the temp file, for editor syntax highlighting. */
  postfix?: string;
}

export type Question<TAnswers extends object = Answers> =
  | IInputQuestion<TAnswers>
  | IWordsQuestion<TAnswers>
  | INumberQuestion<TAnswers>
  | IConfirmQuestion<TAnswers>
  | ISelectQuestion<TAnswers>
  | ISearchQuestion<TAnswers>
  | IPathQuestion<TAnswers>
  | ICheckboxQuestion<TAnswers>
  | IEditorQuestion<TAnswers>;

/** What the scaffolder did (or would do) for one template file. */
export interface IFileResult {
  /** Template file, relative to the template folder. */
  templateFile: string;
  /** Output path relative to the project root, forward slashes. */
  path: string;
  status: 'created' | 'overwritten' | 'skipped' | 'error';
  dryRun: boolean;
  /** Rendered content (always present unless skipped or failed). */
  content?: string;
  /** Why the file was skipped or failed. */
  reason?: string;
  /** Problems that did not stop the file, such as variables that do not exist. */
  warnings: string[];
  commands: ICommandResult[];
}

export interface ICommandResult {
  command: string;
  /** null in a dry run: the command was not executed. */
  exitCode: number | null;
  output: string;
}
