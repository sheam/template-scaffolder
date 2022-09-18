import fs from 'fs';
import inquirer, {DistinctChoice, DistinctQuestion} from 'inquirer';
import {ICliArgs, IConfig, IRequiredInputs} from './types.js';
import {logError, scaffoldingPath} from './util.js';

// @ts-ignore
const inquirerFuzzyPathModule = await import('inquirer-fuzzy-path');
inquirer.registerPrompt('fuzzypath', inquirerFuzzyPathModule.default);

export async function getInitialInputs(cliValues: ICliArgs): Promise<IRequiredInputs> {
    const questions: DistinctQuestion[] = [];

    if (!cliValues.name)
    {
        questions.push({name: 'name', type: 'input', message: 'Enter the name:'});
    }

    if (!cliValues.template)
    {
        const templates = fs.readdirSync(scaffoldingPath(''))
            .map<DistinctChoice>(x => ({value: x, title: x}));

        questions.push({name: 'template', type: 'list', choices: templates, message: 'Select a template:'});
    }

    const userInputs = questions.length > 0 ? await inquirer.prompt(questions) : {};
    const result: IRequiredInputs = {
        NAME: userInputs.name || cliValues.name,
        TEMPLATE: userInputs.template || cliValues.template,
        DESTINATION: undefined,
    };

    if(!result.TEMPLATE) { logError('template must be defined on command line or in user input'); process.exit(-1); }
    if(!result.NAME) { logError('template must be defined on command line or in user input'); process.exit(-1); }

    return result;
}

export async function getOtherInputs(config: IConfig, cliValues: ICliArgs): Promise<any> {

    const questions: DistinctQuestion[] = [];

    if (!cliValues.destination)
    {
        function dirValidator(path: string): boolean | string {
            if (fs.existsSync(path) && fs.statSync(path).isDirectory()) return true;
            return `${path} is not a valid directory`;
        }

        if (config.destinations?.length)
        {
            const destinationChoices = config.destinations.filter(p => dirValidator(p))
                .map<DistinctChoice>(x => ({value: x, title: x}));
            destinationChoices.push({value: '__other__', name: 'Other'});
            questions.push({
                               name: 'destinationSelection',
                               message: 'Select a destination directory:',
                               prefix: 'DIR',
                               choices: destinationChoices,
                               type: 'list',
                           });
        }

        function shouldExcludeDir(dir: string): boolean {
            const containsMatches = ['node_modules'];
            const rxMatches = [/^\.\w/, /\/\.\w/, /\\\.\w/];
            return containsMatches.findIndex(s => dir.indexOf(s) >= 0) >=
                0 ||
                rxMatches.findIndex(rx => rx.test(dir)) >=
                0;

        }

        function shouldGetManualDestination(prev: { destinationSelection: string }): boolean {
            return prev.destinationSelection === '__other__' || prev.destinationSelection === undefined;
        }

        const fuzzyPathQuestion = {
            name: 'destination',
            message: 'Enter a destination directory:',
            type: 'fuzzypath',
            rootPath: config.srcRoot,
            itemType: 'directory',
            excludePath: shouldExcludeDir,
            when: shouldGetManualDestination,
        };
        questions.push(fuzzyPathQuestion as any);
    }

    if (config.prompts?.length)
    {
        config.prompts.forEach(p => questions.push(p));
    }

    const result = await inquirer.prompt(questions);

    result.DESTINATION = result.destination || result.destinationSelection || cliValues.destination;
    delete result.destinationSelection;
    delete result.destination;

    return result;
}
