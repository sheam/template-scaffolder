import { type Logger } from '../logger.js';
import { type IConfigFile } from '../types/index.js';

export interface IGetConfigFileResult<TInput extends object> {
  logging: Logger;
  dir: string;
  config: IConfigFile<TInput> | null;
}
