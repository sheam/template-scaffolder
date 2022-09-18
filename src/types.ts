import {DistinctQuestion} from 'inquirer';

export interface IRequiredInputs
{
    NAME: string | undefined;
    TEMPLATE: string | undefined;
    DESTINATION: string | undefined;
}

export type Variables = {
    [key: string]: string | number;
} & IRequiredInputs;

export interface IConfig
{
    variables?: any,
    destinations?: string[];
    prompts?: DistinctQuestion[];
    createNameDir?: boolean;
    srcRoot?: string;
    afterFileCreated?: (createdFilePath: string) => Promise<void>;
}

export interface ICliArgs
{
    template?: string;
    name?: string;
    destination?: string;
    dryRun?: boolean;
}
