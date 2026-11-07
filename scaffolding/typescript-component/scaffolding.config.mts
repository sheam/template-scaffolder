import { defineConfig } from 'template-scaffolder';

interface IUserInput {}

export default defineConfig<IUserInput>({
    name: 'Simple',
    description: 'for testing velocity templates',
    destinations: ['src/testdir/subdir1', 'src/testdir/subdir2'],
    macros: {
        sayHello: (person: string) => `Well hello there ${person}!!!`
    },
    variables: async ({ name }) => {
        return { VAR1: `variable one ${name}`, VAR2: 'variable two' };
    },
});
