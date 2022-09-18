import fs from 'fs';
import * as path from 'path';
import {IConfig, IRequiredInputs} from './types.js';
import {CONFIG_FILE_NAME, log, scaffoldingPath} from './util.js';

export async function getConfig(initialInputs: IRequiredInputs): Promise<IConfig> {
    if (!initialInputs.TEMPLATE) throw new Error('template must be supplied');

    const templateConfigFile = scaffoldingPath(initialInputs.TEMPLATE, CONFIG_FILE_NAME);

    log(`getting template configuration from ${templateConfigFile}`);
    if (!fs.existsSync(templateConfigFile))
    {
        log(`no variables file found at ${templateConfigFile}`);
        return {};
    }

    const modulePath = 'file://' + path.join(process.cwd(), templateConfigFile);
    log(`modulePath ${modulePath}, cwd=${process.cwd()}`, 1, true);

    const module = await import(modulePath);
    return module.default(initialInputs.NAME);
}
