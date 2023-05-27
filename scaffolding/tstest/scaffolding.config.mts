// IConfig
// {
//     variables?: any,
//     destinations?: string[];
//     prompts?: DistinctQuestion[];
//     createNameDir?: boolean;
//     srcRoot?: string;
//     afterFileCreated?: (createdFilePath: string, variables: any) => Promise<string[]>;
// }

import {IConfigFile} from './types';

const config: IConfigFile = {
    name: 'Simple',
    description: 'for testing velocity templates',
    destinations: ['src/testdir/dir1/subdir1'],
    macros: {
        sayHello: (person: string) => `Well hello there ${person}!!!`
    }
}

export default config;
