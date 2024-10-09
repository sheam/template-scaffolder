import {IConfigFile } from "../../src/types";

interface IUserInput {}

export default {
    name: 'Simple',
    description: 'for testing velocity templates',
    destinations: ['src/testdir/subdir1', 'src/testdir/subdir2'],
    macros: {
        sayHello: (person: string) => `Well hello there ${person}!!!`
    },
    variables: async (name, _inputs) => {
        return { VAR1: `variable one ${name}`, VAR2: 'variable two' };
    },
} as IConfigFile<IUserInput>;
