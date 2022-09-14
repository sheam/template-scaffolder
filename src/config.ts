import * as fs from 'fs';
import * as path from 'path';

const SCAFFOLD_FOLDER_NAME = 'scaffolding';
const CONFIG_FILE_NAME = 'scaffolding.config.js';

export type Variables = { [key: string]: string|number };
export interface IConfig
{
    variables?: any,
    destinations?: string[];
    prompts?: any[];
    createNameDir?: boolean;
}

export function scaffoldingPath(template: string, filePath = ''): string {
    return path.join(SCAFFOLD_FOLDER_NAME, template, filePath).replaceAll('\\', '/');
}

export function log(str: string, indent = 0): void {
    console.log(`${'  '.repeat(indent)}${str}`);
}

export function getConfig(template: string): IConfig
{
    const templateConfigFile = scaffoldingPath(template, CONFIG_FILE_NAME);

    log(`getting template configuration from ${templateConfigFile}`);
    if (!fs.existsSync(templateConfigFile))
    {
        log(`no variables file found at ${templateConfigFile}`);
        return {};
    }

    const modulePath = path.relative(path.dirname(require.main?.filename||'./'), templateConfigFile);
    const config = require(modulePath);

    log('using template variables:', 1);
    Object.keys(config.variables).forEach((key) => {
        const val = config.variables[key];
        if(typeof(val) !== 'string' && typeof(val) !== 'number') {
            throw new Error(`variable ${key} is not of type string or number`);
        }
        log(`${key}='${config.variables[key]}'`, 2);
    });

    return config;
}
