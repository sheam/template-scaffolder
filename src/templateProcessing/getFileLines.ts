import { readFile } from 'node:fs/promises';
import path from 'path';
import { INCLUDES_FOLDER_NAME, SCAFFOLD_FOLDER_NAME } from '../constants.js';
import { PatternList } from '../types.js';

export async function getFileLines(
  filePath: string,
  stripLines: PatternList = [],
  processedFiles: string[]
): Promise<string[]> {
  const shouldKeep = (line: string): boolean => {
    for (const pattern of stripLines) {
      if (typeof pattern === 'string') {
        if (line.trimStart().startsWith(pattern)) {
          return false;
        }
      } else if (pattern.test(line)) {
        return false;
      }
    }
    return true;
  };

  processedFiles.push(filePath);
  const resultLines = new Array<string>();
  const fileText = await readFile(filePath, 'utf-8');
  const lines = fileText.split('\n').filter(shouldKeep);
  for (const line of lines) {
    const matchResult = line.matchAll(/#include\(['"]?([^'")]+)['"]?\)/gi);
    const matches = Array.from(matchResult);
    if (matches.length > 0) {
      for (const match of matches) {
        const includePath = path.join(
          SCAFFOLD_FOLDER_NAME,
          INCLUDES_FOLDER_NAME,
          match[1]
        );
        const lines = await getFileLines(
          includePath,
          stripLines,
          processedFiles
        );
        lines.forEach(l => resultLines.push(l));
      }
    } else {
      resultLines.push(line);
    }
  }
  return resultLines;
}
