import type { IPrompter, IReporter } from './ports.js';
import type { Answers, Question } from './types.js';

/**
 * Ask each question in order, unless `when` skips it or a prior answer exists
 * (from --rerun or programmatic `answers`). Prior answers of `false`, `0` and `''` are kept.
 */
export async function collectAnswers(
  questions: Question[],
  deps: { prompter: IPrompter; reporter: IReporter; prior: Answers }
): Promise<Answers> {
  const answers: Answers = {};
  for (const question of questions) {
    if (question.when && !question.when(answers)) {
      deps.reporter.debug(`skipping question '${question.name}'`);
      continue;
    }
    if (Object.hasOwn(deps.prior, question.name)) {
      const prior = deps.prior[question.name];
      deps.reporter.info(`${question.message.trim()} ${formatAnswer(prior)}`);
      answers[question.name] = prior;
      continue;
    }
    answers[question.name] = await deps.prompter.ask(question);
  }
  return answers;
}

function formatAnswer(value: unknown): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  return String(value);
}
