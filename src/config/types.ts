import { Logger } from '../logger.js';
import { IConfigFile } from '../types/index.js';

export interface IGetConfigFileResult<TInput extends object> {
  logging: Logger;
  dir: string;
  config: IConfigFile<TInput> | null;
}
