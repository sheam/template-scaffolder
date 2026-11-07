/** A small unified diff for showing migration changes (config files are small). */
export function unifiedDiff(
  oldText: string,
  newText: string,
  file: string
): string {
  const context = 2;
  const a = oldText.split('\n');
  const b = newText.split('\n');
  // LCS table
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  type Op = { kind: ' ' | '-' | '+'; line: string; ai: number; bi: number };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      ops.push({ kind: ' ', line: a[i], ai: i++, bi: j++ });
    } else if (
      i < a.length &&
      (j >= b.length || lcs[i + 1][j] >= lcs[i][j + 1])
    ) {
      ops.push({ kind: '-', line: a[i], ai: i++, bi: j });
    } else {
      ops.push({ kind: '+', line: b[j], ai: i, bi: j++ });
    }
  }
  const out = [`--- ${file}`, `+++ ${file} (migrated)`];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].kind === ' ') {
      k++;
      continue;
    }
    const start = Math.max(0, k - context);
    let end = k;
    while (end < ops.length) {
      if (ops[end].kind !== ' ') {
        end++;
        continue;
      }
      let run = 0;
      while (end + run < ops.length && ops[end + run].kind === ' ') run++;
      if (run > context * 2 || end + run >= ops.length) {
        end = Math.min(ops.length, end + context);
        break;
      }
      end += run;
    }
    const hunk = ops.slice(start, end);
    const aLen = hunk.filter(o => o.kind !== '+').length;
    const bLen = hunk.filter(o => o.kind !== '-').length;
    out.push(`@@ -${hunk[0].ai + 1},${aLen} +${hunk[0].bi + 1},${bLen} @@`);
    hunk.forEach(o => out.push(`${o.kind}${o.line}`));
    k = end;
  }
  return out.join('\n');
}
