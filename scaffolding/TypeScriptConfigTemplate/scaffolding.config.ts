// IConfig
// {
//     variables?: any,
//     destinations?: string[];
//     prompts?: DistinctQuestion[];
//     createNameDir?: boolean;
//     srcRoot?: string;
//     afterFileCreated?: (createdFilePath: string, variables: any) => Promise<string[]>;
// }

import {IConfigFile, Question} from "../../src/types";

const config: IConfigFile = {
    name: 'typescript',
    description: 'for testing velocity templates',
    srcRoot: 'src',
    variables: (name: string, input: any): any => ({
        NEW_VARIABLE: `NEW__${name}`,
    }),
    prompts: (name: string): Question[] => [
        {
            type: "list",
            name: "COLOR",
            message: "Enter your favourite color: ",
            choices: [
                { value: 'red', name: 'Red' },
                { value: 'green', name: 'Green' },
                { value: 'blue', name: 'Blue' },
            ],
        }
    ],
};

export default config;
