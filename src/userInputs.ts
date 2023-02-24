import fs from 'fs';
import inquirer, {DistinctChoice, DistinctQuestion} from 'inquirer';
import {getTemplateDescriptors} from './config.js';
import {ICliArgs, IConfigFile, IInitialInputs, IFinalizedInputs, ITemplateDescriptor} from './types.js';
import {logError} from './util.js';
import {DEFAULT_SRC_ROOT} from "./constants.js";
import {getBuiltIns} from "./builtIns.js";

const inquirerFuzzyPathModule = await import('inquirer-fuzzy-path');
inquirer.registerPrompt('fuzzypath', inquirerFuzzyPathModule.default);

/**
 * Setup config based on command line values.
 * Determine which template we are going to use so that we can read the file later.
 * @param cliValues values acquired from the command line.
 */
export async function getInitialInputs(cliValues: ICliArgs): Promise<IInitialInputs> {
    const questions: DistinctQuestion[] = [];

    if (!cliValues.name)
    {
        questions.push({name: 'name', type: 'input', message: 'Enter the name:'});
    }

    const templates = await getTemplateDescriptors();
    let templateDescriptor: ITemplateDescriptor|undefined = undefined;
    if (cliValues.template)
    {
        templateDescriptor = templates.find(td => td.name === cliValues.template) ||
                             templates.find(td => td.dir === cliValues.template);

        if(!templateDescriptor)
        {
            logError(`Could not find template ${cliValues.template}`);
            process.exit(-1);
        }
    }
    else
    {
        const getTitle = (td: ITemplateDescriptor) => {
          let s = td.name || td.dir;
          if(!td.description) return s;
          return `${s} - ${td.description.substring(0, 50)}`
        };
        const templateChoices = templates.map<DistinctChoice>(td => ({value: td.dir, name: getTitle(td)}));
        questions.push({name: 'template', type: 'list', choices: templateChoices, message: 'Select a template:'});
    }

    const userInputs = questions.length > 0 ? await inquirer.prompt(questions) : {};

    if(userInputs.template)
    {
        templateDescriptor = templates.find(td => td.name === userInputs.template) ||
                             templates.find(td => td.dir === userInputs.template);
    }

    if(!templateDescriptor)
    {
        throw new Error(`Missing template ${cliValues.template}`);
    }

    const result: IInitialInputs = {
        instanceName: userInputs.name || cliValues.name,
        template: templateDescriptor,
    };

    if(!result.template) throw new Error('template must be defined on command line or in user input');
    if(!result.instanceName) throw new Error('instance name must be defined on command line or in user input');

    return result;
}

/**
 * Determine the values missing from command line and config file,
 * and prompt user for what we can't determine a reasonable default for.
 * This should be run after getInitialInputs(). and getConfig().
 * @param config config file options.
 * @param cliValues command line options.
 * @param requiredInputs what we were able to determine from the getInitialInputs function.
 */
export async function finalizeInputs(config: IConfigFile, cliValues: ICliArgs, requiredInputs: IInitialInputs): Promise<IFinalizedInputs> {

    const srcRoot = getSrcRoot(config);
    const questions: DistinctQuestion[] = [];

    let hardCodedDestination = '';
    if (typeof(config.destinations) === 'string') {
        if (fs.existsSync(config.destinations) && fs.statSync(config.destinations).isDirectory()) {
            hardCodedDestination = config.destinations;
        } else {
            throw new Error(`destination '${config.destinations}' is not a valid directory`);
        }
    }

    if (!cliValues.destination && !hardCodedDestination)
    {
        addDestinationPrompt(srcRoot, config.destinations, questions);
    }

    if(typeof(config.prompts) === 'function')
    {
        config.prompts(requiredInputs.instanceName).forEach(p => questions.push(p));
    }

    if(Array.isArray(config.prompts))
    {
        config.prompts.forEach(p => questions.push(p));
    }

    const answers = await inquirer.prompt(questions);

    const destination = answers.destination || answers.destinationSelection || cliValues.destination || hardCodedDestination;
    delete answers.destinationSelection;
    delete answers.destination;

    const configVariables = typeof(config.variables) === 'function' ?
        config.variables(requiredInputs.instanceName) :
        (config.variables||{});

    const builtIns = await getBuiltIns(config, requiredInputs);

    return {
        destination,
        srcRoot,
        afterFileCreated: config.afterFileCreated,
        createNameDir: config.createNameDir === true || config.createNameDir === undefined,
        template: requiredInputs.template,
        instanceName: requiredInputs.instanceName,
        variables:  Object.assign(builtIns.variables, answers, configVariables),
        macros: Object.assign(config.macros||{},builtIns.macros),
        stripLines: config.stripLines,
    };
}

/**
 * Add a prompt to get destination directory to existing question list.
 */
function addDestinationPrompt(srcRoot: string, destinations: string[]|string|undefined, questions: DistinctQuestion[]): void
{
    function dirValidator(path: string): boolean | string {
        if (fs.existsSync(path) && fs.statSync(path).isDirectory()) return true;
        console.log(`destination path '${path}' is not a valid directory`);
        return false;
    }

    function shouldExcludeDir(dir: string): boolean {
        const containsMatches = ['node_modules'];
        const rxMatches = [/^\.\w/, /\/\.\w/, /\\\.\w/];
        return containsMatches.findIndex(s => dir.indexOf(s) >= 0) >= 0 ||
            rxMatches.findIndex(rx => rx.test(dir)) >= 0;
    }

    function shouldGetManualDestination(prev: { destinationSelection: string }): boolean {
        return prev.destinationSelection === '__other__' || prev.destinationSelection === undefined;
    }

    if (Array.isArray(destinations))
    {
        const destinationChoices = destinations.filter(p => dirValidator(p))
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

    console.log(`srcRoot=[${srcRoot}]`);
    const fuzzyPathQuestion = {
        name: 'destination',
        message: `Enter a destination directory:`,
        type: 'fuzzypath',
        rootPath: srcRoot,
        itemType: 'directory',
        excludePath: shouldExcludeDir,
        when: shouldGetManualDestination,
    };
    questions.push(fuzzyPathQuestion as any);
}

function getSrcRoot(config: IConfigFile): string
{
    if (config.srcRoot)
    {
        return config.srcRoot;
    }
    if (fs.existsSync(DEFAULT_SRC_ROOT))
    {
        return DEFAULT_SRC_ROOT;
    }
    return process.cwd();
}
