import {DistinctQuestion} from 'inquirer';

export type TemplateVariables = {
    [key: string]: string | number;
};

export interface IConfigFile
{
    name?: string;
    description?: string;
    version?: string;
    variables?: object | ((instanceName: string) => any),
    prompts?: DistinctQuestion[] | ((instanceName: string) => DistinctQuestion[]);
    c?: Array<string|RegExp>;
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
    variables: TemplateVariables;
    srcRoot: string;
    afterFileCreated: IConfigFile['afterFileCreated'];
    stripLines: Array<string|RegExp>|undefined;
    createNameDir: boolean;
    macros: object|undefined;
}

export interface ICliArgs
{
    template?: string;
    name?: string;
    destination?: string;
    dryRun?: boolean;
}

export interface IInitialInputs
{
    instanceName: string;
    template: ITemplateDescriptor;
}
