import fs from 'fs';
import path from 'path';
import {IConfig, Variables} from './types.js';
import {CONFIG_FILE_NAME, log, logError, padString, scaffoldingPath} from './util.js';
import {exec} from 'child_process';

function replaceVariables(text: string, variables: Variables): string {
    return Object.keys(variables).reduce((text, key) => {
        const value = variables[key];
        const target = `$${key}$`;
        return text.replaceAll(target, value.toString());
    }, text);
}

function getFileContents(path: string, variables: Variables): string {
    const fileText = fs.readFileSync(path, 'utf-8');
    return replaceVariables(fileText, variables);
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

function execCommand(command: string): Promise<void>
{
    function logLines(prefix: string, text: string, indent: number): void
    {
        const lines = text.split(/\n/);
        lines.forEach(line => log(`${prefix}${line}`, indent));
    }

    return new Promise((resolve, reject) => {
        const process = exec(command);

        process.stdout?.on('data', (data) => logLines('[stdout]:', data, 3));
        process.stderr?.on('data', (data) => logLines('[stderr]:', data, 3));
        process.on('error', () => logError('failed to run command'));
        process.on('close', (code) => {
            log(`command exited with status: ${code}`, 2);
            resolve();
        });
    });
}

async function createFileFromTemplate(template: string, destinationRootDir: string, variables: Variables, config: IConfig, name: string, file: string, dryRun: boolean): Promise<void> {
    if (!fs.existsSync(destinationRootDir) || !fs.statSync(destinationRootDir).isDirectory())
    {
        logError(`Destination specified is not a directory: ${destinationRootDir}`);
        process.exit(-1);
    }

    const createNameDir = config.createNameDir || config.createNameDir === undefined;
    const destinationDirPath = createNameDir ? path.join(destinationRootDir, name) : destinationRootDir;
    const destinationPath = replaceVariables(path.join(destinationDirPath, file), variables);

    if (fs.existsSync(destinationPath))
    {
        logError(`file ${destinationPath} already exists, can't process template.`);
        process.exit(-1);
    }

    const content = getFileContents(scaffoldingPath(template, file), variables);
    if (dryRun)
    {
        log(padString(` ${destinationPath} `));
        log(content);
        log('-'.repeat(80));
    }
    else
    {
        log(`creating ${destinationPath}`, 1);
        fs.mkdirSync(path.dirname(destinationPath), {recursive: true});
        fs.writeFileSync(destinationPath, content);
    }

    if (config.afterFileCreated)
    {
        const commands = await config.afterFileCreated(destinationPath, variables);
        for(const command of commands)
        {
            log(`executing ${command}`, 2);
            if(!dryRun)
            {
                await execCommand(command);
            }
        }
    }
}

export async function createTemplates(config: IConfig, variables: Variables, dryRun?: boolean): Promise<void> {
    if (!variables.TEMPLATE) { logError('TEMPLATE must be defined'); process.exit(-1); }
    if (!variables.DESTINATION) { logError('DESTINATION must be defined'); process.exit(-1); }
    if (!variables.NAME) { logError('NAME must be defined'); process.exit(-1); }

    const template = variables.TEMPLATE;
    const destination = variables.DESTINATION;
    const name = variables.NAME;
    const templateFiles = getTemplateFiles(template);

    for(const templateFile of templateFiles)
    {
        await createFileFromTemplate(template, destination, variables, config, name, templateFile, dryRun || false);
    }
}
