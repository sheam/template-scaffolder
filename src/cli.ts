import {IArgsConfig, processArgs} from 'node-cli-arg-by-config';
import {ICliArgs} from './types.js';

const cliConfig: IArgsConfig = {
    helpHeader: 'scaffolder <args>',
    definitions: [
        { name: 'dryRun', type: 'boolean', description: 'If set then resulting files will just be written to STDOUT.' },
        { name: 'overwrite', type: 'boolean', required: false, description: 'Overwrite output files.'},
        { name: 'name', description: 'Name of the output.' },
        { name: 'template', description: 'Name of the template. This foldering in scaffolding directory'},
        { name: 'destination', index: 0, required: false, description: 'Root folder where generated files are to be deployed.'}
    ]
}

export function getArgs(): ICliArgs
{
    const args = processArgs<ICliArgs>(cliConfig);
    if(!args)
    {
        process.exit(-1);
    }
    return args;
}
