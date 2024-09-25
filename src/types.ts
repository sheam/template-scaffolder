
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
    prompts?: unknown[] | ((instanceName: string) => unknown[]);
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
