// import { IConfigFile } from "../../src/types";

interface IUserInput {}

//TODO: make this work when not an NPM module

export default {
    name: 'Simple',
    description: 'for testing velocity templates',
    destinations: ['src/testdir/subdir1', 'src/testdir/subdir2'],
    macros: {
        sayHello: (person: string) => `Well hello there ${person}!!!`
    }
}; // as IConfigFile<IUserInput>
