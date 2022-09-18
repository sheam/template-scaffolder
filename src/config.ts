import fs from 'fs';
import * as path from 'path';
import {IConfigFile, IInitialInputs, ITemplateDescriptor} from './types.js';
import {CONFIG_FILE_NAME, log, scaffoldingPath} from './util.js';

export async function getTemplateDescriptors(): Promise<ITemplateDescriptor[]> {
    const result: ITemplateDescriptor[] = [];
    const templateDirs = fs.readdirSync(scaffoldingPath(''));
    for (const templateDir of templateDirs)
    {
        try
        {
            const config = await loadConfigFile(templateDir);
            result.push({dir: templateDir, name: config.name || templateDir, description: config.description});
        }
        catch (_)
        {
            result.push({name: templateDir, dir: templateDir});
        }
    }
    return result;
}

async function loadConfigFile(templateDir: string): Promise<IConfigFile> {
    const templateConfigFile = scaffoldingPath(templateDir, CONFIG_FILE_NAME);
    const modulePath = 'file://' + path.join(process.cwd(), templateConfigFile);
    log(`modulePath ${modulePath}, cwd=${process.cwd()}`, 0, true);
    const config = await import(modulePath);
    return config.default;
}

export async function getConfig(initialInputs: IInitialInputs): Promise<IConfigFile> {

    const templateConfigFile = scaffoldingPath(initialInputs.template.dir, CONFIG_FILE_NAME);

    log(`getting template configuration from ${templateConfigFile}`);
    if (!fs.existsSync(templateConfigFile))
    {
        log(`no valid configuration found at ${templateConfigFile}`);
        process.exit(-1);
    }

    return await loadConfigFile(initialInputs.template.dir);
}
