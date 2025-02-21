import { IInitialPromptResult } from '../userInputs/types.js';

export type TemplateVariableValue = unknown;
export type TemplateVariables = {
  [key: string]: TemplateVariableValue;
};

export type PatternList = Array<string | RegExp> | undefined;

// eslint-disable-next-line @typescript-eslint/ban-types
export type MacroObject = { [key: string]: Function };

export interface ILastRunConfig {
  lastRunConfigFormatVersion: string;
  name: string;
  destination: string;
  args: ICliArgs;
  promptResults: IPromptResult[];
}

export interface IPromptResult {
  name: string;
  answer: boolean | string | number | null;
}

export interface IConfigFile<TInput extends object> {
  name?: string;
  description?: string;
  version?: string;
  variables?:
    | TemplateVariables
    | ((
        instanceName: string,
        initialInputs: TInput
      ) => Promise<TemplateVariables>);
  prompts?:
    | Question<TInput>[]
    | ((
        instanceName: string
      ) => Promise<Question<TInput>[]> | Question<TInput>[]);
  stripLines?: PatternList;
  // eslint-disable-next-line @typescript-eslint/ban-types
  macros?:
    | MacroObject
    | ((instanceName: string, initialInputs: TInput) => Promise<MacroObject>);
  destinations?: Array<string> | string;
  createNameDir?: boolean;
  srcRoot?: string;
  afterFileCreated?: (
    createdFilePath: string,
    dryRun: boolean,
    variablesHash: TemplateVariables
  ) => string[];
}

export interface ITemplateDescriptor<TInput extends object> {
  dir: string;
  config: IConfigFile<TInput>;
}

export interface IFinalizedInputs<TInput extends object> {
  instanceName: string;
  template: ITemplateDescriptor<TInput>;
  destination: string;
  overwrite: boolean;
  variables: TemplateVariables;
  srcRoot: string;
  afterFileCreated: IConfigFile<TInput>['afterFileCreated'];
  stripLines: Array<string | RegExp> | undefined;
  createNameDir: boolean;
  macros: MacroObject;
  answers: IInitialPromptResult & TInput;
}

export interface ICliArgs {
  template?: string;
  name?: string;
  destination?: string;
  dryRun?: boolean;
  overwrite?: boolean;
  parallel?: boolean;
  workDir?: string;
  rerun?: boolean;
}

export interface IInitialInputs<TInput extends object> {
  instanceName: string;
  template: ITemplateDescriptor<TInput>;
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

export interface IQuestionBase<TInput extends object> {
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
  name: keyof TInput;

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

export interface IConfirmQuestion<TInput extends object>
  extends IQuestionBase<TInput> {
  type: 'confirm';
  default?: boolean;
}

export interface IInputQuestion<TInput extends object>
  extends IQuestionBase<TInput> {
  type?: 'input';
  default?: string;
}

export interface INumberQuestion<TInput extends object>
  extends IQuestionBase<TInput> {
  type: 'number';
  default?: number;
}

export interface ISearchQuestion<TInput extends object>
  extends IQuestionBase<TInput> {
  type: 'search';
  source?: (input: string | undefined) => Promise<IChoice[]>;
  choices?: IChoice[];
  default?: string;
}

export interface ISelectQuestion<TInput extends object>
  extends IQuestionBase<TInput> {
  type: 'select';
  choices: IChoice[];
  default?: string;
}

export interface IPathSelectQuestion<TInput extends object>
  extends IQuestionBase<TInput> {
  type: 'path';
  itemType?: 'file' | 'directory';
  allowManualInput?: boolean;
  rootPath?: string;
  depthLimit?: number;
  excludePath?: (pathInfo: IPathInfo) => boolean;
  default?: string;
}

export type Question<TInput extends object> =
  | ISelectQuestion<TInput>
  | IInputQuestion<TInput>
  | INumberQuestion<TInput>
  | ISearchQuestion<TInput>
  | IConfirmQuestion<TInput>
  | IPathSelectQuestion<TInput>;
