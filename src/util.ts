import fs from 'fs';
import path from 'path';

export function log(str: string, indent = 0, debug=false): void {
    if(debug && !process.env.DEBUG) return;
    console.log(`${'  '.repeat(indent)}${str}`);
}

export function logError(str: string): void
{
    console.error(str);
}

export const SCAFFOLD_FOLDER_NAME = 'scaffolding';
export const CONFIG_FILE_NAME = 'scaffolding.config.js';

export function verifyScaffoldingFolder(): void
{
    let error = false;
    if(fs.existsSync(SCAFFOLD_FOLDER_NAME))
    {

        const templates = fs.readdirSync(scaffoldingPath(''));
        if(templates.length <= 0)
        {
            logError(`No templates exist in ${path.resolve(SCAFFOLD_FOLDER_NAME)}`);
            error = true;
        }
    }
    else
    {
        logError(`Scaffolding folder does not exist at ${path.resolve(SCAFFOLD_FOLDER_NAME)}`);
        error = true;
    }

    if(error)
    {
        log('Please create a scaffolding folder and at least one template before running again.');
        process.exit(-1);
    }
}

export function scaffoldingPath(template: string, filePath = ''): string
{
    return path.join(SCAFFOLD_FOLDER_NAME, template, filePath).replaceAll('\\', '/');
}

export function printValues(variables: any, debug=false): void {
    function wrapValue(val: unknown): string
    {
        if(val === null) return 'null';
        switch(typeof(val))
        {
            case 'undefined': return 'undefined';
            case 'string': return `'${val}'`;
            case 'object': return `[${val.toString()}]`
            default: return val.toString();
        }
    }
    Object.keys(variables).forEach((key) => {
        const val = variables[key];
        log(`${key}=${wrapValue(variables[key])}`, 1, debug);
    });
}

export function padString(str: string, char = '-', lineLen = 80): string
{
    if(str.length >= lineLen) return str;
    const remaining = lineLen - str.length;
    const startPad = Math.round(remaining / 2);
    return str.padStart(str.length + startPad, char).padEnd(lineLen, char);
}
