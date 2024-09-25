export type TemplateVariables = {
    [key: string]: string | number;
};

export type PatternList = Array<string|RegExp>|undefined;

export interface IConfigFile
{
    name?: string;
    description?: string;
    version?: string;
    variables?: object | ((instanceName: string, initialInputs: any) => any),
    prompts?: Question[] | ((instanceName: string) => Question[]);
    stripLines: PatternList;
    macros?: object;
    destinations?: Array<string>|string;
    createNameDir?: boolean;
    srcRoot?: string;
    afterFileCreated?: (createdFilePath: string, dryRun: boolean, variablesHash: TemplateVariables) => Promise<string[]>;
}

export interface ITemplateDescriptor
{
    name: string;
    dir: string;
    description?: string;
}

export interface IFinalizedInputs
{
    instanceName: string;
    template: ITemplateDescriptor;
    destination: string;
    overwrite: boolean;
    variables: TemplateVariables;
    srcRoot: string;
    afterFileCreated: IConfigFile['afterFileCreated'];
    stripLines: Array<string|RegExp>|undefined;
    createNameDir: boolean;
    macros: object;
}

export interface ICliArgs
{
    template?: string;
    name?: string;
    destination?: string;
    dryRun?: boolean;
    overwrite?: boolean;
}

export interface IInitialInputs
{
    instanceName: string;
    template: ITemplateDescriptor;
}

export interface IChoice {
    value: string
    name?: string;
    description?: string
    disabled?: boolean;
}

export interface IPathInfo {
    path: string;
    name: string;
    isDir: boolean;
}

interface IQuestionBase {
    type?: 'fuzzypath' | 'path' | 'select' | 'list' | 'search' | 'confirm' | 'separator' | 'number' | 'input' | undefined;
    name: string;
    message: string;
    default?: string | number | boolean;
    required?: boolean;
    when?: <TAnswerObject extends object>(previousAnswer: TAnswerObject) => boolean;
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
    return (q as IInputQuestion).type === 'input' || (q as IInputQuestion).type === undefined;
}

interface INumberQuestion extends IQuestionBase {
    type: 'number';
    default?: number;
}

export function isNumberQuestion(q: IQuestionBase): q is INumberQuestion {
    return (q as INumberQuestion).type === 'number';
}

export interface ISearchQuestion extends IQuestionBase {
    type: 'search',
    source?: (input: string | undefined) => Promise<IChoice[]>;
    choices?: IChoice[];
    default?: string;
}

export function isSearchQuestion(q: IQuestionBase): q is ISearchQuestion {
    return (q as ISearchQuestion).type === 'search';
}

interface ISelectQuestion extends IQuestionBase {
    type: 'select' | 'list',
    choices: IChoice[];
    default?: string;
}

export function isSelectQuestion(q: IQuestionBase): q is ISelectQuestion {
    return (q as ISelectQuestion).type === 'select' || (q as ISelectQuestion).type === 'list';
}

export interface IPathSelectQuestion extends IQuestionBase {
    type: 'fuzzypath' | 'path';
    itemType?: 'file' | 'directory';
    allowManualInput?: boolean;
    rootPath?: string;
    maxDepth?: number;
    excludePath?: (pathInfo: IPathInfo) => boolean;
    default?: string;
}

export function isPathSelectQuestion(q: IQuestionBase): q is IPathSelectQuestion {
    return (q as IPathSelectQuestion).type === 'path' || (q as IPathSelectQuestion).type === 'fuzzypath';
}

export type Question =
    ISelectQuestion
    | IInputQuestion
    | INumberQuestion
    | ISearchQuestion
    | IConfirmQuestion
    | IPathSelectQuestion;
