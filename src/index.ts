import * as fs from 'fs';
import * as path from 'path';
import {getConfig, IConfig, log, scaffoldingPath, Variables} from './config';

function replaceVariables(text: string, config: IConfig): string
{
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
        .map(p => p.substring(templateDir.length+1))
        .filter(p => p !== 'variables.js');
}

function createFileFromTemplate(template: string, destinationDir: string, config: IConfig, name: string, file: string, dryRun=false): void
{
    if(!fs.statSync(destinationDir).isDirectory())
    {
        throw new Error(`Destination specified is not a directory: ${destinationDir}`);
    }

    const destinationPath = replaceVariables(path.join(destinationDir, name, file), config);
    if(fs.existsSync(destinationPath))
    {
        throw new Error(`file ${destinationPath} already exists, try deleting ${path.join(destinationDir, name)} any try again`);
    }

    const content = getFileContents(scaffoldingPath(template, file), config);
    if(dryRun)
    {
        log(`write file ${destinationPath}:`, 0)
        log('-'.repeat(80));
        log(content);
        log('-'.repeat(80));
    }
    else
    {
        fs.mkdirSync(path.dirname(destinationPath), {recursive: true});

        log(`creating ${destinationPath}`);
        fs.writeFileSync(destinationPath, content);
    }
}

process.env.NAME = 'MyComponent';
const config = getConfig('component');
const files = getTemplateFiles('component');
files.forEach(f => {
    createFileFromTemplate('component', 'temp', config, 'MyComponent', f, true);
});

