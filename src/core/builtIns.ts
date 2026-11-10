import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { INormalizedConfig } from './config.js';
import type { IBuiltIns } from './types.js';

const execFileAsync = promisify(execFile);

export async function getBuiltIns(
  config: INormalizedConfig,
  name: string
): Promise<IBuiltIns> {
  return {
    NAME: name,
    TEMPLATE_NAME: config.name,
    TEMPLATE_VERSION: config.version,
    USERNAME: await getUserName(),
  };
}

let cachedUserName: Promise<string> | undefined;

/** git user.name, then git user.email, then USERNAME/USER, then 'Unknown'. */
export function getUserName(): Promise<string> {
  cachedUserName ??= (async () =>
    (await gitConfig('user.name')) ||
    (await gitConfig('user.email')) ||
    process.env.USERNAME ||
    process.env.USER ||
    'Unknown')();
  return cachedUserName;
}

/** For tests that change the git identity between runs. */
export function resetUserNameCache(): void {
  cachedUserName = undefined;
}

async function gitConfig(key: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['config', key]);
    return stdout.trim();
  } catch {
    return '';
  }
}
