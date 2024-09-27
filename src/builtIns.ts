import { execCommand } from './templateProcessing/helpers.js';
import { IConfigFile, IInitialInputs } from './types.js';

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

let cachedUserName: string;
async function getUserName(): Promise<string> {
  if (cachedUserName) return cachedUserName;

  async function getCommandOutput(command: string): Promise<string> {
    try {
      let output = '';
      const code = await execCommand(command, text => (output = text));
      if (code !== 0) {
        return '';
      }
      return output?.trim();
    } catch (e) {
      return '';
    }
  }

  let userName: string;
  userName = await getCommandOutput('git config user.name');
  if (!userName) {
    userName = await getCommandOutput('git config user.email');
  }
  cachedUserName = userName || process.env.USERNAME || 'Unknown';
  return cachedUserName;
}
