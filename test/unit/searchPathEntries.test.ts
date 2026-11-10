import { describe, expect, it } from 'vitest';
import { searchPathEntries } from '../../src/cli/pathSearch.js';
import type { IPathInfo } from '../../src/core/types.js';

const fileEntries: IPathInfo[] = [
  {
    path: 'src/components/alerts/ProductionCapAlert.tsx',
    name: 'ProductionCapAlert.tsx',
    isDir: false,
  },
  {
    path: 'src/components/alerts/QueryAlert.tsx',
    name: 'QueryAlert.tsx',
    isDir: false,
  },
  {
    path: 'src/components/app/AppSettings.ts',
    name: 'AppSettings.ts',
    isDir: false,
  },
  {
    path: 'src/components/app/AuthenticationInfo.tsx',
    name: 'AuthenticationInfo.tsx',
    isDir: false,
  },
];

describe('searchPathEntries', () => {
  it('matches word prefixes in order across path segments', () => {
    const result = searchPathEntries('al qu', fileEntries);
    expect(result).toHaveLength(1);
    expect(result[0].path).toEqual(fileEntries[1].path);
  });

  it('returns everything for blank input', () => {
    expect(searchPathEntries('  ', fileEntries)).toHaveLength(4);
  });

  it('matches a single substring case-insensitively', () => {
    expect(searchPathEntries('SETTINGS', fileEntries).map(x => x.name)).toEqual(
      ['AppSettings.ts']
    );
  });
});
