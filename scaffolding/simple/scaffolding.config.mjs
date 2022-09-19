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
    name: 'Simple',
    description: 'for testing velocity templates',
    destinations: ['src/testdir/dir1/subdir1'],
}
