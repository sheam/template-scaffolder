import { IChoice, ISearchQuestion } from '../types/index.js';

export type SearchQuestionImplementation<TInput extends object> = Required<
  Pick<ISearchQuestion<TInput>, 'source'>
> &
  ISearchQuestion<TInput>;

export function getSearchQuestion<TInput extends object>(
  q: ISearchQuestion<TInput>
): SearchQuestionImplementation<TInput> {
  if (q.source) {
    return q as SearchQuestionImplementation<TInput>;
  }
  const choices = q.choices!;
  delete q.choices;
  q.source = async (input: string | undefined): Promise<IChoice[]> => {
    if (!input) {
      return choices;
    }
    const targets = input.trim().toLowerCase().split(/\s+/);
    return choices.filter(c => {
      const val = c.value.toLowerCase();
      const name = c.name?.toLowerCase();
      for (const target of targets) {
        if (!val.includes(target) && !(name && name.includes(target))) {
          return false;
        }
      }
      return true;
    });
  };
  return q as SearchQuestionImplementation<TInput>;
}
