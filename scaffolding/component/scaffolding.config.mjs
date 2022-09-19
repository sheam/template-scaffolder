// IConfig
// {
//     variables?: any,
//     destinations?: string[];
//     prompts?: DistinctQuestion[];
//     createNameDir?: boolean;
//     srcRoot?: string;
//     afterFileCreated?: (createdFilePath: string, variables: any) => Promise<string[]>;
// }

export default {
    name: 'React Component',
    description: 'Used for creating a react component',
    variables: (name) => ({
        Component: name,
        TestId: name.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase(),
    }),
    prompts: (_name) => ([
        {
            name: 'somevar',
            message: 'Enter a value for SomeVar:',
        }
    ]),
    destinations: ['src/testdir/dir1/subdir1'],
}
