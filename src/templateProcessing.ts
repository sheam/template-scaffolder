import fs from 'fs';
import path from 'path';
import {CONFIG_FILE_NAME} from './constants.js';
import {IFinalizedInputs, TemplateVariables} from './types.js';
import {log, logError, padString, scaffoldingPath} from './util.js';
import {exec} from 'child_process';

const velocityModule = await import('velocityjs');
const velocity = velocityModule.default;

function replaceVariables(text: string, variables: TemplateVariables, macros?: object): string {
    return velocity.render(text, variables, macros);
}

function getFileContents(path: string, variables: TemplateVariables, macros: object|undefined): string {
    const fileText = fs.readFileSync(path, 'utf-8');
    try
    {
        return replaceVariables(fileText, variables, macros);
    }
    catch (parseError: any) {
        logError(`error processing template '${path}':\n${parseError.message}`);
        process.exit(-1);
    }
}

function getDestinationPath(rawPath: string, variables: TemplateVariables): string
{
    try
    {
        return replaceVariables(rawPath.replaceAll('\\', '/'), variables);
    }
    catch (parseError: any) {
        logError(`error transforming destination file path '${rawPath}':\n${parseError.message}`);
        process.exit(-1);
    }
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

    return new Promise((resolve, _reject) => {
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

async function createFileFromTemplate(processConfig: IFinalizedInputs, file: string, dryRun: boolean): Promise<void> {
    if (!fs.existsSync(processConfig.destination) || !fs.statSync(processConfig.destination).isDirectory())
    {
        logError(`Destination specified is not a directory: ${processConfig.destination}`);
        process.exit(-1);
    }

    const destinationDirPath = processConfig.createNameDir ?
        path.join(processConfig.destination, processConfig.instanceName) :
        processConfig.destination;

    const destinationPath = getDestinationPath(path.join(destinationDirPath, file), processConfig.variables);

    if (fs.existsSync(destinationPath))
    {
        logError(`file ${destinationPath} already exists, can't process template.`);
        process.exit(-1);
    }

    const content = getFileContents(
        scaffoldingPath(processConfig.template.dir, file),
        processConfig.variables,
        processConfig.macros);

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

    if (processConfig.afterFileCreated)
    {
        const commands = await processConfig.afterFileCreated(destinationPath, dryRun, processConfig.variables);
        if(Array.isArray(commands))
        {
            for (const command of commands)
            {
                log(`executing ${command}`, 2);
                if (!dryRun)
                {
                    await execCommand(command);
                }
            }
        }
    }
}

export async function createTemplates(processConfig: IFinalizedInputs, dryRun?: boolean): Promise<void> {
    const templateFiles = getTemplateFiles(processConfig.template.dir);

    for(const templateFile of templateFiles)
    {
        await createFileFromTemplate(processConfig, templateFile, dryRun || false);
    }
}
