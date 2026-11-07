// Drives the real inquirer prompts with simulated keystrokes.
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createConsolePrompter } from '../../src/cli/prompter.js';
import { tempProject } from '../helpers.js';
import type { Question } from '../../src/core/types.js';

const ENTER = '\r';
const DOWN = '\x1b[B';
const SPACE = ' ';

/** Ask one question, typing `keys` one chunk at a time once the prompt is drawn. */
async function answer(
  question: Question,
  keys: string[]
): Promise<{ value: unknown; screen: string }> {
  const input = new PassThrough();
  const output = new PassThrough();
  let screen = '';
  output.on('data', chunk => (screen += chunk.toString()));
  Object.assign(input, { isTTY: true, setRawMode: () => input });
  const pending = createConsolePrompter({ input, output }).ask(question);
  for (const key of keys) {
    await new Promise(r => setTimeout(r, 15));
    input.write(key);
  }
  return { value: await pending, screen };
}

describe('console prompter', () => {
  it('input, with default', async () => {
    expect(
      (await answer({ name: 'A', message: 'Name?' }, ['Tank', ENTER])).value
    ).toBe('Tank');
    expect(
      (await answer({ name: 'A', message: 'Name?', default: 'Def' }, [ENTER]))
        .value
    ).toBe('Def');
  });

  it('words splits on whitespace or a separator', async () => {
    expect(
      (
        await answer({ name: 'W', type: 'words', message: 'w' }, [
          'a  b c',
          ENTER,
        ])
      ).value
    ).toEqual(['a', 'b', 'c']);
    expect(
      (
        await answer(
          { name: 'W', type: 'words', message: 'w', separator: ',' },
          ['x, y z', ENTER]
        )
      ).value
    ).toEqual(['x', 'y z']);
  });

  it('number and confirm', async () => {
    expect(
      (await answer({ name: 'N', type: 'number', message: 'n' }, ['42', ENTER]))
        .value
    ).toBe(42);
    expect(
      (await answer({ name: 'C', type: 'confirm', message: 'c' }, ['y', ENTER]))
        .value
    ).toBe(true);
  });

  it('select shows names and returns values', async () => {
    const { value, screen } = await answer(
      {
        name: 'S',
        type: 'select',
        message: 's',
        choices: [{ value: 'a', name: 'Alpha' }, { value: 'b' }],
      },
      [DOWN, ENTER]
    );
    expect(value).toBe('b');
    expect(screen).toContain('Alpha');
  });

  it('search filters choices by typed words', async () => {
    const q: Question = {
      name: 'S',
      type: 'search',
      message: 's',
      choices: [{ value: 'one' }, { value: 'two' }, { value: 'three' }],
    };
    expect((await answer(q, ['th', ENTER])).value).toBe('three');
  });

  it('checkbox returns the checked values', async () => {
    const q: Question = {
      name: 'C',
      type: 'checkbox',
      message: 'c',
      choices: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
      default: ['a'],
    };
    expect((await answer(q, [DOWN, DOWN, SPACE, ENTER])).value).toEqual([
      'a',
      'c',
    ]);
  });

  it('path lists directories under rootPath and searches them', async () => {
    const root = tempProject({
      dirs: ['src/components/alerts', 'src/pages/setup', 'src/node_modules/x'],
    });
    const q: Question = {
      name: 'P',
      type: 'path',
      message: 'p',
      rootPath: `${root}/src`,
      itemType: 'directory',
      excludePath: info => info.name === 'node_modules',
    };
    const { value } = await answer(q, ['pa se', ENTER]);
    expect(value).toBe(`${root}/src/pages/setup`.replaceAll('\\', '/'));
  });

  it('turns Ctrl-C into UserCancelledError', async () => {
    await expect(
      answer({ name: 'A', message: 'a' }, ['\x03'])
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
