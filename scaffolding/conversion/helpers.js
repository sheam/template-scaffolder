export function getInterfaces(inputs) {
    return [
        {
            name: 'MyInterfaceOne',
            fields: [
                { name: 'Name', typeName: 'string' },
                { name: 'Age', typeName: 'number' },
                { name: 'Something', typeName: inputs.PromptedType }
            ],
        },
        {
            name: 'MyInterfaceTwo',
            fields: [
                { name: 'Colour', typeName: 'string' },
                { name: 'Hex', typeName: 'number' },
            ],
        },
    ];
}
