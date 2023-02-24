export const camelCaseToKebabCase = (str) =>
    str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase());

export const camelCaseToTitleWords = (str) =>
    (str.charAt(0).toUpperCase() + str.slice(1))
        .replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? " " : "") + $);

export const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export function formatFileCommand(path, dryRun) {
    if(dryRun) return null;
    return [ `npx prettier --write "${path}"` ];
}
