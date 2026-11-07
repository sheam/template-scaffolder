import { availableParallelism } from 'node:os';

/**
 * Map over items with bounded concurrency, returning results in input order.
 * `parallel: false` processes one item at a time.
 */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  options: { parallel: boolean; limit?: number }
): Promise<R[]> {
  const limit = options.parallel
    ? Math.max(1, options.limit ?? availableParallelism())
    : 1;
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}
