export type TemplateVariableValue = unknown;
export type TemplateVariables = {
  [key: string]: TemplateVariableValue;
};

export type PatternList = Array<string | RegExp> | undefined;

// eslint-disable-next-line @typescript-eslint/ban-types
export type MacroObject = { [key: string]: Function };

export interface IConfigFile<TInput extends object> {
  name?: string;
  description?: string;
  version?: string;
  variables?:
    | TemplateVariables
    | ((instanceName: string, initialInputs: TInput) => TemplateVariables);
  prompts?: Question[] | ((instanceName: string) => Question[]);
  stripLines?: PatternList;
  // eslint-disable-next-line @typescript-eslint/ban-types
  macros?: MacroObject;
  destinations?: Array<string> | string;
  createNameDir?: boolean;
  srcRoot?: string;
  afterFileCreated?: (
    createdFilePath: string,
    dryRun: boolean,
    variablesHash: TemplateVariables
  ) => string[];
}

export interface ITemplateDescriptor {
  name: string;
  dir: string;
  description?: string;
}

export interface IFinalizedInputs<TInput extends object> {
  instanceName: string;
  template: ITemplateDescriptor;
  destination: string;
  overwrite: boolean;
  variables: TemplateVariables;
  srcRoot: string;
  afterFileCreated: IConfigFile<TInput>['afterFileCreated'];
  stripLines: Array<string | RegExp> | undefined;
  createNameDir: boolean;
  macros: MacroObject;
}

export interface ICliArgs {
  template?: string;
  name?: string;
  destination?: string;
  dryRun?: boolean;
  overwrite?: boolean;
  parallel?: boolean;
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

export interface IQuestionBase {
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

export interface IConfirmQuestion extends IQuestionBase {
  type: 'confirm';
  default?: boolean;
}

export interface IInputQuestion extends IQuestionBase {
  type?: 'input';
  default?: string;
}

export interface INumberQuestion extends IQuestionBase {
  type: 'number';
  default?: number;
}

export interface ISearchQuestion extends IQuestionBase {
  type: 'search';
  source?: (input: string | undefined) => Promise<IChoice[]>;
  choices?: IChoice[];
  default?: string;
}

export interface ISelectQuestion extends IQuestionBase {
  type: 'select';
  choices: IChoice[];
  default?: string;
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

export type Question =
  | ISelectQuestion
  | IInputQuestion
  | INumberQuestion
  | ISearchQuestion
  | IConfirmQuestion
  | IPathSelectQuestion;
