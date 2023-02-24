import {IConfigFile, IInitialInputs} from "./types.js";
import {getUserName} from "./util.js";

export async function getBuiltIns(config: IConfigFile, initialInputs: IInitialInputs)
{
    return {
        variables: {
            NAME: initialInputs.instanceName,
            TEMPLATE_NAME: config.name || initialInputs.template.name,
            TEMPLATE_VERSION: config.version || '1.0',
            USERNAME: await getUserName(),
        },
        macros: {
        }
    };
}
