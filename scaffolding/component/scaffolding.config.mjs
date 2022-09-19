export default {
    name: 'React Component',
    description: 'Used for creating a react component',
    variables: (name) => ({
        COMPONENT: name,
        TEST_ID: name.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase(),
    }),
    prompts: (_name) => ([
        {
            name: 'SOME_VAL',
            message: 'Enter a value for SOME_VAL:',
        }
    ]),
    macros: {
        repeatString: (str, n) => `${str} `.repeat(n).trimEnd()
    },
    afterFileCreated: (path) => {
        console.log(`>>>>>>>>>>>> ${path}`);
    },
    destinations: ['src/testdir/dir1/subdir1'],
}
