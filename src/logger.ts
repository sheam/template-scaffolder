interface ILine {
  line: string;
  indent: number;
  type: 'stdout' | 'stderr' | 'debug';
}

const IS_DEBUG = process.env.DEBUG === 'true';
export const INDENT = '  ';

export class Logger {
  private readonly _stdoutPrefix: string;
  private readonly _stderrPrefix: string;
  private readonly _debugPrefix: string;
  private readonly _lines = new Array<ILine>();

  constructor(
    errorPrefix: string = 'stderr',
    outputPrefix: string = '',
    debugPrefix: string = ''
  ) {
    this._stderrPrefix = errorPrefix;
    this._stdoutPrefix = outputPrefix;
    this._debugPrefix = debugPrefix;
  }

  hasError(): boolean {
    return this._lines.filter(x => x.type === 'stderr').length > 0;
  }

  hasOutput(): boolean {
    return this._lines.filter(x => x.type !== 'stderr').length > 0;
  }

  append(text: string, indent = 0, isDebug = false): void {
    if (isDebug && !IS_DEBUG) return;
    this.getLinesFromText(text).forEach(line =>
      this._lines.push({ line, indent, type: isDebug ? 'debug' : 'stdout' })
    );
  }

  appendError(text: string, indent = 0): void {
    this.getLinesFromText(text).forEach(line =>
      this._lines.push({ line, indent, type: 'stderr' })
    );
  }

  private getLinesFromText(text: string): string[] {
    return text.split(/\n/);
  }

  private prefix(line: ILine): string {
    if (line.type === 'stderr') {
      return this._stderrPrefix;
    }
    if (line.type === 'stdout') {
      return this._stdoutPrefix;
    }
    if (line.type === 'debug') {
      return this._debugPrefix;
    }
    throw new Error('Unknown line type');
  }

  toString(): string {
    return this._lines
      .map(l => `${INDENT.repeat(l.indent)}${this.prefix(l)}${l.line}`)
      .join('\n');
  }

  dump(): void {
    // eslint-disable-next-line no-console
    console.log(this.toString());
  }
}

export function log(str: string, indent = 0, isDebug = false): void {
  if (isDebug && !IS_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(`${INDENT.repeat(indent)}${str}`);
}

export function logError(str: string): void {
  // eslint-disable-next-line no-console
  console.warn(str);
}
