import {getInterfaces} from "./helpers.js";

export default {
    name: 'Conversion',
    description: 'a template which relies on reading another file.',
    destinations: './src',
    variables: (name, inputs) => ({
        INTERFACES: getInterfaces(inputs),
    }),
    createNameDir: true,
    prompts: [
        {
            name: 'PromptedType',
            message: 'enter type name',
        }
    ],
    macros: {
        sayHello: (person) => `Well hello there ${person}!!!`
    }
}
