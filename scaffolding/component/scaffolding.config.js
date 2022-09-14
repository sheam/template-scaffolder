const name = process.env.NAME;

module.exports = {
    variables: {
        Component: name,
        TestId: name.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase(),
        OtherVar: '',
    },
    prompts: [],
    destinations: ['src/path/components', 'src/path/tables'],
}
