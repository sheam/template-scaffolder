import fs from 'fs';
import path from 'path';
import {IConfig, Variables} from './types.js';
import {CONFIG_FILE_NAME, log, padString, scaffoldingPath} from './util.js';

function replaceVariables(text: string, config: IConfig): string {
    return Object.keys(config.variables).reduce((text, key) => {
        const value = config.variables[key];
        const target = `$${key}$`;
        return text.replaceAll(target, value.toString());
    }, text);
}

function getFileContents(path: string, config: IConfig): string {
    const fileText = fs.readFileSync(path, 'utf-8');
    return replaceVariables(fileText, config);
}

function getTemplateFiles(template: string): string[] {
    function readDirRecursive(dir: string): string[] {
        const files = new Array<string>();
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory())
            {
                const subFiles = readDirRecursive(fullPath);
                subFiles.forEach(x => files.push(x));
            }
            else
            {
                files.push(fullPath);
            }
        });
        return files;
    }

    const templateDir = scaffoldingPath(template);
    return readDirRecursive(scaffoldingPath(template))
        .map(p => p.substring(templateDir.length + 1))
        .filter(p => p !== CONFIG_FILE_NAME);
}

async function createFileFromTemplate(template: string, destinationDir: string, config: IConfig, name: string, file: string, dryRun: boolean): Promise<void> {
    if (!fs.existsSync(destinationDir) || !fs.statSync(destinationDir).isDirectory())
    {
        throw new Error(`Destination specified is not a directory: ${destinationDir}`);
    }

    const destinationPath = replaceVariables(path.join(destinationDir, name, file), config);
    if (fs.existsSync(destinationPath))
    {
        throw new Error(`file ${destinationPath} already exists, try deleting ${path.join(
            destinationDir,
            name,
        )} any try again`);
    }

    const content = getFileContents(scaffoldingPath(template, file), config);

    if (dryRun)
    {
        log(padString(` ${file} `));
        log(content);
        log('-'.repeat(80));
    }
    else
    {
        log(`creating ${destinationPath}`, 1);
        fs.mkdirSync(path.dirname(destinationPath), {recursive: true});
        fs.writeFileSync(destinationPath, content);
        if(config.afterFileCreated)
        {
            await config.afterFileCreated(path.resolve(destinationPath));
        }
    }
}

export async function createTemplates(config: IConfig, variables: Variables, dryRun?: boolean): Promise<void>
{
    if(!variables.TEMPLATE) throw new Error('TEMPLATE must be defined');
    if(!variables.DESTINATION) throw new Error('DESTINATION must be defined');
    if(!variables.NAME) throw new Error('NAME must be defined');
    const template = variables.TEMPLATE;
    const destination = variables.DESTINATION;
    const name = variables.NAME;
    const templateFiles = getTemplateFiles(template);
    await templateFiles.forEach(createFile);

    async function createFile(templateFile: string): Promise<void>
    {
        await createFileFromTemplate(template, destination, config, name, templateFile, dryRun||false);
    }
}
