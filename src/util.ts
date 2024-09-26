import { readdir } from "node:fs/promises";
import { existsSync } from 'fs';
import path from 'path';
import {SCAFFOLD_FOLDER_NAME} from './constants.js';
import {exec} from "child_process";

export function log(str: string, indent = 0, debug=false): void {
    if(debug && !process.env.DEBUG) return;
    console.log(`${'  '.repeat(indent)}${str}`);
}

export function logError(str: string): void
{
    console.error(str);
}

export async function verifyScaffoldingFolder(): Promise<void>
{
    let error = false;
    if(existsSync(SCAFFOLD_FOLDER_NAME))
    {

        const templates = await readdir(scaffoldingPath(''));
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

export function printValues(variables: any, debug=false, indent: number = 0): void {
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
        if(val && Array.isArray(val) && typeof(val) !== 'string')
        {
            log(`${key}: [`, indent, debug);
            val.forEach(item => log(wrapValue(item), indent+1, debug));
            log(']', indent, debug);
        }
        else if(val && typeof(val) === 'object')
        {
            log(`${key}:`, indent, debug);
            printValues(val, debug, indent+1);
        }
        else
        {
            log(`${key}=${wrapValue(variables[key])}`, indent, debug);
        }
    });
}

export function padString(str: string, char = '-', lineLen = 80): string
{
    if(str.length >= lineLen) return str;
    const remaining = lineLen - str.length;
    const startPad = Math.round(remaining / 2);
    return str.padStart(str.length + startPad, char).padEnd(lineLen, char);
}

export function execCommand(
    command: string,
    handleStdOutText?: (text: string) => void,
    handleStdErrText?: (text: string) => void,
): Promise<number|null>
{
    return new Promise((resolve, reject) => {
        const process = exec(command);
        if(handleStdOutText) {
            process.stdout?.on('data', handleStdOutText);
        }
        if(handleStdErrText) {
            process.stderr?.on('data', handleStdErrText);
        }
        process.on('error', () => {
            logError('failed to run command');
            reject();
        });
        process.on('close', (code) => {
            resolve(code);
        });
    });
}

let _cachedUserName: string;
export async function getUserName(): Promise<string> {
    if(_cachedUserName) return _cachedUserName;

    async function getCommandOutput(command: string): Promise<string>
    {
        try {
            let output = '';
            const code = await execCommand(command, (text) => output = text);
            if(code !== 0) {
                return '';
            }
            return output?.trim();

        } catch(e) {
            return '';
        }
    }

    let userName: string;
    userName = await getCommandOutput('git config user.name');
    if(!userName) {
        userName = await getCommandOutput('git config user.email');
    }
    _cachedUserName = userName || process.env.USERNAME || 'Unknown';
    return _cachedUserName;
}
