import { IConfigFile, IInitialInputs } from './types.js';
import { getUserName } from './util.js';

export async function getBuiltIns(
  config: IConfigFile,
  initialInputs: IInitialInputs
): Promise<IConfigFile> {
  return {
    variables: {
      NAME: initialInputs.instanceName,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      TEMPLATE_NAME: config.name || initialInputs.template.name,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      TEMPLATE_VERSION: config.version || '1.0',
      USERNAME: await getUserName(),
    },
    macros: {},
  };
}
