import { IChoice, ISearchQuestion } from '../types';

export type SearchQuestionImplementation = Required<
  Pick<ISearchQuestion, 'source'>
> &
  ISearchQuestion;

export function getSearchQuestion(
  q: ISearchQuestion
): SearchQuestionImplementation {
  if (q.source) {
    return q as SearchQuestionImplementation;
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
  return q as SearchQuestionImplementation;
}
