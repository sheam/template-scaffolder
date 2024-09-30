interface ILine {
  line: string;
  indent: number;
  type: 'stdout' | 'stderr' | 'debug';
}

const IS_DEBUG = process.env.DEBUG === 'true';
export const INDENT = '  ';

export class Logger {
  private _indent: number;
  private readonly _stdoutPrefix: string;
  private readonly _stderrPrefix: string;
  private readonly _debugPrefix: string;
  private readonly _lines = new Array<ILine>();

  // eslint-disable-next-line max-params
  constructor(
    indent: number = 0,
    errorPrefix: string = 'stderr: ',
    outputPrefix: string = '',
    debugPrefix: string = ''
  ) {
    this._indent = indent;
    this._stderrPrefix = errorPrefix;
    this._stdoutPrefix = outputPrefix;
    this._debugPrefix = debugPrefix;
  }

  indent(): Logger {
    this._indent++;
    return this;
  }

  unindent(): Logger {
    Math.max(this._indent - 1, 0);
    return this;
  }

  hasError(): boolean {
    return this._lines.filter(x => x.type === 'stderr').length > 0;
  }

  hasOutput(): boolean {
    return this._lines.filter(x => x.type !== 'stderr').length > 0;
  }

  append(text: string, isDebug = false): void {
    if (isDebug && !IS_DEBUG) return;
    this.getLinesFromText(text).forEach(line =>
      this._lines.push({
        line,
        indent: this._indent,
        type: isDebug ? 'debug' : 'stdout',
      })
    );
  }

  appendError(text: string): void {
    this.getLinesFromText(text).forEach(line =>
      this._lines.push({ line, indent: this._indent, type: 'stderr' })
    );
  }

  private getLinesFromText(text: string): string[] {
    return text.split(/\n/);
  }

  private prefix(line: ILine): string {
    if (!line.line) return '';
    if (line.type === 'stderr') return this._stderrPrefix;
    if (line.type === 'stdout') return this._stdoutPrefix;
    if (line.type === 'debug') return this._debugPrefix;
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
