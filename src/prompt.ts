import {confirm, input, number, search, select} from '@inquirer/prompts';
import {readdir, stat} from "node:fs/promises";
import path from "path";
import {
    IChoice,
    IPathInfo,
    IPathSelectQuestion,
    isConfirmQuestion,
    ISearchQuestion,
    isInputQuestion,
    isNumberQuestion,
    isPathSelectQuestion,
    isSearchQuestion,
    isSelectQuestion,
    Question
} from "./types.js";

const MANUAL_ENTRY_VALUE = '__manual_entry__';

// @ts-ignore
Array.prototype.findLastIndex = function(predicate) { for (let i = this.length - 1; i >= 0; i--) { if (predicate(this[i], i, this)) { return i; } } return -1; };

export async function prompt<TResult extends object>(questions: Question[]): Promise<TResult> {
    const answers = new Array<(string|number|boolean|undefined)[]>();
    for(const question of questions) {
        if(question.when) {
            if(!question.when(Object.fromEntries(answers) as TResult)) {
                continue;
            }
        }
        if(isInputQuestion(question)) {
            answers.push([question.name, await input(question)]);
        } else if(isConfirmQuestion(question)) {
            answers.push([question.name, await confirm(question)]);
        } else if(isNumberQuestion(question)) {
            answers.push([question.name, await number(question)]);
        } else if(isSelectQuestion(question)) {
            answers.push([question.name, await select(question)]);
        } else if(isSearchQuestion(question)) {
            answers.push([question.name, await search(getSearchQuestion(question))]);
        } else if(isPathSelectQuestion(question)) {
            const pathQuestion = await getPathQuestion(question);
            const answer = await search(pathQuestion);
            if(answer === MANUAL_ENTRY_VALUE) {
                answers.push([question.name, await input({ ...question, message: 'enter path' })]);
            } else {
                answers.push([question.name, answer]);
            }
        } else {
            throw new Error(`Unsupported question type: ${JSON.stringify(question)}`);
        }
    }
    return Object.fromEntries(answers) as TResult;
}

type SearchQuestionImplementation = Required<Pick<ISearchQuestion, 'source'>> & ISearchQuestion;

function getSearchQuestion(q: ISearchQuestion):  SearchQuestionImplementation {
    if(q.source) {
        return q as SearchQuestionImplementation;
    }
    const choices = q.choices!;
    delete q.choices;
    q.source = async (input: string|undefined): Promise<IChoice[]> => {
        if(!input) {
            return choices;
        }
        const targets = input.trim().toLowerCase().split(/\s+/);
        return choices.filter(c => {
            const val = c.value.toLowerCase()
            const name = c.name?.toLowerCase();
            for(const target of targets) {
                if(!val.includes(target) && !(name && name.includes(target))) {
                    return false;
                }
            }
            return true;
        });
    };
    return q as SearchQuestionImplementation;
}

export async function getPathQuestion(q: IPathSelectQuestion): Promise<SearchQuestionImplementation> {
    const pathEntries = await getDir(q.rootPath || process.cwd(), 0, q);
    return {
        type: 'search',
        name: q.name,
        message: q.message,
        default: q.default,
        source: (input) => searchPathEntryChoices(input, pathEntries, q.allowManualInput === true),
    };
}

async function searchPathEntryChoices(input: string|undefined, fileEntries: IPathInfo[], allowManual: boolean): Promise<IChoice[]> {
    const entries = searchPathEntries(input, fileEntries).map(x => ({name: x.path, value: x.path}));
    if(allowManual) {
        entries.push({name: 'manual path entry', value: MANUAL_ENTRY_VALUE});
    }
    return entries;
}

export function searchPathEntries(input: string|undefined, fileEntries: IPathInfo[]): IPathInfo[] {
    if(!input?.trim()){
        return fileEntries;
    }
    const targets = input.trim().toLowerCase().split(/\s+/);
    if(targets.length === 0) {
        return fileEntries;
    }
    if(targets.length === 1) {
        return fileEntries.filter(info => info.path.toLowerCase().includes(targets[0]));
    }

    return fileEntries.filter(info => {
        const parts = info.path.split(/\/|(?=[A-Z])/).map(s => s.toLowerCase());
        let lastFoundIndex = -1;
        for(const target of targets) {
            const foundIndex = parts.findIndex((part, i) => i > lastFoundIndex && part.startsWith(target));
            if(foundIndex >= 0) {
                lastFoundIndex = foundIndex;
            } else {
                return false;
            }
        }
        return true;
    });
}

async function getDir(rootPath: string,  currentDepth: number, q: IPathSelectQuestion): Promise<IPathInfo[]> {
    const result = new Array<IPathInfo>();
    // console.log(`processing ${rootPath} (depth=${currentDepth})`);
    if(typeof q.maxDepth === 'number' && currentDepth >= q.maxDepth) {
        return result;
    }

    const entryPaths = await readdir(rootPath);
    for(const entry of entryPaths) {
        const entryPath = path.join(rootPath, entry);
        const entryStat = await stat(entryPath);
        const entryInfo: IPathInfo = {
            path: entryPath.replaceAll('\\', '/'),
            name: entry,
            isDir: entryStat.isDirectory(),
        };
        if(q.excludePath && q.excludePath(entryInfo)) {
            continue;
        }
        if(entryInfo.isDir) {
            if(q.itemType !== 'file') {
                result.push(entryInfo);
            }
            const dirResults = await getDir(entryPath, currentDepth + 1, q);
            result.push(...dirResults);
        } else if(q.itemType !== 'directory') {
            result.push(entryInfo);
        }
    }
    return result;
}
