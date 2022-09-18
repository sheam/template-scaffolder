import path from 'path';

export function log(str: string, indent = 0, debug=false): void {
    if(debug && !process.env.DEBUG) return;
    console.log(`${'  '.repeat(indent)}${str}`);
}

export const SCAFFOLD_FOLDER_NAME = 'scaffolding';
export const CONFIG_FILE_NAME = 'scaffolding.config.js';

export function scaffoldingPath(template: string, filePath = ''): string
{
    return path.join(SCAFFOLD_FOLDER_NAME, template, filePath).replaceAll('\\', '/');
}

export function printValues(variables: any, debug=false): void {
    Object.keys(variables).forEach((key) => {
        const val = variables[key];
        log(`${key}='${variables[key]}'`, 1, debug);
    });
}

export function padString(str: string, char = '-', lineLen = 80): string
{
    if(str.length >= lineLen) return str;
    const remaining = lineLen - str.length;
    const startPad = Math.round(remaining / 2);
    return str.padStart(str.length + startPad, char).padEnd(lineLen, char);
}
