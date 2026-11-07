import {camelCaseToKebabCase, camelCaseToTitleWords} from "../_templateHelpers/index.mjs";
import os from "os";

export default {
    name: 'React Component',
    description: 'Used for creating a react component',
    variables: ({ name, answers: inputs }) => ({
        COMPONENT: name,
        HOME: os.homedir(),
        STORY_TITLE: camelCaseToTitleWords(name),
        TEST_ID: camelCaseToKebabCase(name),
        OTHER_VAL: inputs.SOME_VAL.toLowerCase(),
    }),
    prompts: () => ([
        {
            name: 'SOME_VAL',
            message: 'Enter a value for SOME_VAL:',
            type: 'search',
            source: (input) => {
                const options = [ 'one', 'two', 'three', 'four', 'five' ];
                if(!input) {
                    return options.map(x => ({value: x}))
                }
                return options.filter(x => x.toLowerCase().includes(input.toLowerCase())).map(x => ({value: x}));
            },
            required: true,
        }
    ]),
    macros: {
        repeatString: (str, n) => `${str} `.repeat(n).trimEnd()
    },
    hooks: {
        afterFileCreated: ({ path: _path, dryRun: _dryRun, variables: _variables }) => {
            //console.log(`>>>>>>>>>>>> '${variables.NAME}' template created ${path}`);
        },
    },
    stripLines: [
        '// TEMPLATE:', //template comments
        /\/\/.*\bSTRIP\b/,
    ],
    srcRoot: './src',
    // destination: './src/testdir',
    // destinations: ['src/testdir/dir1/subdir1'],
}
