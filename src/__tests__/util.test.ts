import { IPathInfo } from '../types';

import { searchPathEntries } from '../prompts/path';

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

describe('file search', () => {
  it('finds file with one word', () => {
    const result = searchPathEntries('al qu', fileEntries);
    expect(result).toHaveLength(1);
    expect(result[0].path).toEqual(fileEntries[1].path);
  });
});
