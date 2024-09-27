import { IConfigFile, Question } from "../../src/types.js";

export default {
    name: 'typescript',
    description: 'for testing velocity templates',
    srcRoot: 'src',
    variables: (name: string, input: object): any => ({
        NEW_VARIABLE: `NEW__${name}`,
    }),
    prompts: (name: string): Question[] => [
        {
            type: "select",
            name: "COLOR",
            message: "Enter your favourite color: ",
            choices: [
                { value: 'red', name: 'Red' },
                { value: 'green', name: 'Green' },
                { value: 'blue', name: 'Blue' },
            ],
        }
    ],
} as IConfigFile;
