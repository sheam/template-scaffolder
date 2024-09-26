import path from 'path';
import {CONFIG_FILE_NAME, INCLUDES_FOLDER_NAME, SCAFFOLD_FOLDER_NAME} from './constants.js';
import {IFinalizedInputs, PatternList, TemplateVariables} from './types.js';
import {execCommand, log, logError, padString, scaffoldingPath} from './util.js';
import {readdir, stat, readFile, mkdir, writeFile} from "node:fs/promises";
import {existsSync} from "fs";

const velocityModule = await import('velocityjs');
const velocity = velocityModule.default;

function processTemplate(text: string, variables: TemplateVariables, macros?: object): string {
    return velocity.render(text, variables, macros);
}

async function getFileContents(path: string, variables: TemplateVariables, macros: object, stripPatterns: PatternList): Promise<string> {
    const processedFiles = new Array<string>();
    try
    {
        const fileLines = await getFileLines(path, stripPatterns, processedFiles);
        return processTemplate(fileLines.join('\n'), variables, macros);
    }
    catch (error: any) {
        let message = `Error processing template file '${path}':`;
            message += `\n  message: ${error.message}`;
            message += `\n  files: ${processedFiles.join(' -> ')}`;
        logError(message);
        process.exit(-1);
    }
}

function getDestinationPath(rawPath: string, variables: TemplateVariables): string
{
    try
    {
        return processTemplate(rawPath.replaceAll('\\', '/'), variables);
    }
    catch (parseError: any) {
        logError(`error transforming destination file path '${rawPath}':\n${parseError.message}`);
        process.exit(-1);
    }
}

async function getTemplateFiles(template: string): Promise<string[]> {
    async function readDirRecursive(dir: string): Promise<string[]> {
        const files = new Array<string>();
        const dirs = await readdir(dir);
        for(const file of dirs) {
            const fullPath = path.join(dir, file);
            const fstat = await stat(fullPath);
            if (fstat.isDirectory())
            {
                const subFiles = await readDirRecursive(fullPath);
                subFiles.forEach(x => files.push(x));
            }
            else
            {
                files.push(fullPath);
            }
        }
        return files;
    }

    const templateDir = scaffoldingPath(template);
    const dirs = await readDirRecursive(scaffoldingPath(template));
    return dirs.map(p => p.substring(templateDir.length + 1)).filter(p => p !== CONFIG_FILE_NAME);
}

async function runAfterCreateCommand(command: string): Promise<void>
{
    function logLines(prefix: string, text: string, indent: number): void
    {
        const lines = text.split(/\n/);
        lines.forEach(line => log(`${prefix}${line}`, indent));
    }

    const code = await execCommand(
        command,
        ((text) => logLines('[stdout]:', text, 3)),
        ((text) => logLines('[stderr]:', text, 3))
    );

    log(`command exited with status: ${code}`, 2);
}

async function createFileFromTemplate(processConfig: IFinalizedInputs, file: string, dryRun: boolean): Promise<void> {
    if (!existsSync(processConfig.destination) || !(await stat(processConfig.destination)).isDirectory())
    {
        logError(`Destination specified is not a directory: ${processConfig.destination}`);
        process.exit(-1);
    }

    const destinationDirPath = processConfig.createNameDir ?
        path.join(processConfig.destination, processConfig.instanceName) :
        processConfig.destination;

    const destinationPath = getDestinationPath(path.join(destinationDirPath, file), processConfig.variables);

    if (!processConfig.overwrite && existsSync(destinationPath))
    {
        log(`WARN: file ${destinationPath} already exists, can't process template. Skipping this file`);
        return;
    }

    const content = await getFileContents(
        scaffoldingPath(processConfig.template.dir, file),
        processConfig.variables,
        processConfig.macros,
        processConfig.stripLines);

    if (dryRun)
    {
        log(padString(` ${destinationPath} `, '⌄'));
        log(content);
        log('⌃'.repeat(80) + '\n\n');
    }
    else
    {
        log(`creating ${destinationPath}`, 1);
        await mkdir(path.dirname(destinationPath), {recursive: true});
        await writeFile(destinationPath, content);
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
                    await runAfterCreateCommand(command);
                }
            }
        }
    }
}

export async function createTemplates(processConfig: IFinalizedInputs, dryRun?: boolean): Promise<void> {
    const templateFiles = await getTemplateFiles(processConfig.template.dir);

    for(const templateFile of templateFiles)
    {
        await createFileFromTemplate(processConfig, templateFile, dryRun || false);
    }
}

async function getFileLines(filePath: string, stripLines: PatternList = [], processedFiles: string[]): Promise<string[]> {
    const shouldKeep = (line: string): boolean => {
        for (const pattern of stripLines) {
            if (typeof (pattern) === 'string') {
                if (line.trimStart().startsWith(pattern)) {
                    return false;
                }
            } else if (pattern.test(line)) {
                return false;
            }
        }
        return true;
    }

    processedFiles.push(filePath);
    const resultLines = new Array<string>();
    const fileText = await readFile(filePath, 'utf-8');
    const lines = fileText.split('\n').filter(shouldKeep);
    for(const line of lines) {
        const matchResult = line.matchAll(/#include\(['"]?([^'")]+)['"]?\)/ig);
        const matches = Array.from(matchResult);
        if(matches.length > 0)
        {
            for(const match of matches)
            {
                const includePath = path.join(SCAFFOLD_FOLDER_NAME, INCLUDES_FOLDER_NAME, match[1]);
                const lines = await getFileLines(includePath, stripLines, processedFiles);
                lines.forEach(l => resultLines.push(l));
            }
        } else {
            resultLines.push(line);
        }
    }
    return resultLines;
}
