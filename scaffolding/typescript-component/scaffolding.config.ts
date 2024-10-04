import {IConfigFile } from "../../src/types/index.js";

interface IUserInput {}

export default {
    name: 'Simple',
    description: 'for testing velocity templates',
    destinations: ['src/testdir/subdir1', 'src/testdir/subdir2'],
    macros: {
        sayHello: (person: string) => `Well hello there ${person}!!!`
    }
} as IConfigFile<IUserInput>;
