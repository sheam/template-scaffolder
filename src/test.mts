import { prompt, getPathQuestion } from './prompt.js';
import { IChoice, Question } from './types.js';

const questions: Question[] = [
  // {
  //     type: 'path',
  //     name: 'file',
  //     message: 'please select a file',
  //     // rootPath: 'src',
  //     rootPath: 'C:/Users/sheam/source/repos/BrewNinja/StrangeBrewWeb/StrangeBrew.App/src',
  //     // maxDepth: 2,
  //     itemType: 'file',
  //     allowManualInput: true,
  //     excludePath: x => x.isDir && x.name === 'node_modules' || x.name.startsWith('.'),
  // },
  {
    type: 'confirm',
    name: 'needColor',
    message: 'Pick a color? ',
    required: true,
  },
  {
    type: 'select',
    name: 'color',
    message: 'What is your color?',
    choices: [{ value: 'red' }, { value: 'blue' }],
    when: (answers: any): boolean => answers.needColor === true,
  },
  // {
  //     name: 'name',
  //     message: 'What is your name?'
  // },
  // {
  //     type: 'number',
  //     name: 'age',
  //     message: 'what is your age',
  // },
  // {
  //     type: 'search',
  //     name: 'found-source',
  //     message: 'fav animal via source function?',
  //     source: async (search: string|undefined): Promise<IChoice[]> => {
  //         if(!search) return [];
  //         const animals = [ 'horse', 'pig', 'cat', 'dog', 'hamster', 'rat', 'guinea pig'];
  //         return animals.filter(a => a.includes(search.toLowerCase())).map(x => ({value: x}));
  //     }
  // },
  // {
  //     type: 'search',
  //     name: 'found-choices',
  //     message: 'fav animal via search?',
  //     choices: [ 'horse', 'pig', 'cat', 'dog', 'hamster', 'rat', 'guinea pig', 'eastern fox', 'red fox', 'great porker'].map(x => ({value: x})),
  // },
  // {
  //     type: 'confirm',
  //     name: 'continue',
  //     message: 'would you like to continue?',
  //     default: false,
  // },
];

const result = await prompt(questions);

console.log(JSON.stringify(result, null, 2));

// await getPathQuestion(    {
//     type: 'path',
//     name: 'file',
//     message: 'please select a file',
//     rootPath: 'src',
//     maxDepth: 1,
//     itemType: 'file',
//     excludePath: x => x.isDir && x.name === 'node_modules' || x.name.startsWith('.'),
// });
