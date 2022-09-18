// IConfig
// {
//     variables?: any,
//     destinations?: string[];
//     prompts?: DistinctQuestion[];
//     createNameDir?: boolean;
//     srcRoot?: string;
//     afterFileCreated?: (createdFilePath: string, variables: any) => Promise<string[]>;
// }
async function afterCreate(path) {
    return [
        `git status ${path}`,
    ];
}

export default function (name) {
    return {
        variables: {
            Component: name,
            TestId: name.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase(),
        },
        // prompts: [
        //     {
        //         name: 'somevar',
        //         message: 'Enter a value for SomeVar:',
        //     }
        // ],
        destinations: ['src/path/components', 'src/path/tables'],
        srcRoot: './src',
        afterFileCreated: afterCreate,
    };
};
