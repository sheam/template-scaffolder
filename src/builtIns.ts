import { IConfigFile, IInitialInputs } from './types/index.js';
import { execCommand } from './util.js';

export async function getBuiltIns<TInput extends object>(
  config: IConfigFile<TInput>,
  initialInputs: IInitialInputs<TInput>
): Promise<IConfigFile<TInput>> {
  return {
    variables: {
      NAME: initialInputs.instanceName,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      TEMPLATE_NAME: config.name || initialInputs.template.config.name,
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
