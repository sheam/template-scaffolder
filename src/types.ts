import {DistinctQuestion} from 'inquirer';

export interface IConfig
{
    variables?: any,
    destinations?: string[];
    prompts?: DistinctQuestion[];
    createNameDir?: boolean;
    srcRoot?: string;
    afterFileCreated?: (createdFilePath: string, variables: any) => Promise<void>;
}

export interface ICliArgs
{
    template?: string;
    name?: string;
    destination?: string;
    dryRun?: boolean;
}

export interface IRequiredInputs
{
    NAME: string | undefined;
    TEMPLATE: string | undefined;
    DESTINATION: string | undefined;
}

export type Variables = {
    [key: string]: string | number;
} & IRequiredInputs;
