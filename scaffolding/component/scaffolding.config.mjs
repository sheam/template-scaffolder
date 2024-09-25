import {camelCaseToKebabCase, camelCaseToTitleWords} from "../_templateHelpers/index.mjs";

export default {
    name: 'React Component',
    description: 'Used for creating a react component',
    variables: (name) => ({
        COMPONENT: name,
        STORY_TITLE: camelCaseToTitleWords(name),
        TEST_ID: camelCaseToKebabCase(name),
    }),
    prompts: (_name) => ([
        {
            name: 'SOME_VAL',
            message: 'Enter a value for SOME_VAL:',
            type: 'search',
            source: (input) => {
                const options = [ 'one', 'two', 'three', 'four', 'five' ];
                return options.filter(x => x.toLowerCase().includes(input.toLowerCase())).map(x => ({value: x}));
            },
            required: true,
        }
    ]),
    macros: {
        repeatString: (str, n) => `${str} `.repeat(n).trimEnd()
    },
    afterFileCreated: (path, _dryRun, variables) => {
        //console.log(`>>>>>>>>>>>> '${variables.NAME}' template created ${path}`);
    },
    stripLines: [
        '// TEMPLATE:', //template comments
        /\/\/.*\bSTRIP\b/,
    ],
    srcRoot: './src',
    destinations: './src/testdir',
    // destinations: ['src/testdir/dir1/subdir1'],
}
