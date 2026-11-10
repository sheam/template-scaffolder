import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderTemplateFile } from '../../src/core/render.js';
import { tempProject, writeFiles } from '../helpers.js';

const TEMPLATE = [
  '#include(header.txt)',
  '#set($greeting = "Hi")',
  '// STRIP me',
  '#foreach($n in [1, 2])',
  '$greeting $NAME $n',
  '#end',
  'done',
  '',
];

async function render(eol: string): Promise<string> {
  const root = tempProject();
  writeFiles(root, {
    'tpl/file.txt': TEMPLATE.join(eol),
    'includes/header.txt': ['// header', ''].join(eol),
  });
  return renderTemplateFile({
    sourcePath: path.join(root, 'tpl/file.txt'),
    includesDir: path.join(root, 'includes'),
    variables: { NAME: 'Tank' },
    macros: {},
    stripLines: ['// STRIP'],
  });
}

describe('renderTemplateFile', () => {
  it('renders CRLF templates like LF ones and keeps their line endings', async () => {
    const lf = await render('\n');
    expect(lf).toBe('// header\n\nHi Tank 1\nHi Tank 2\ndone\n');
    expect(await render('\r\n')).toBe(lf.replaceAll('\n', '\r\n'));
  });
});
