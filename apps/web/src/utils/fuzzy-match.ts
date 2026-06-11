interface FuzzyResult {
  match: boolean;
  indices: number[];
}

export function fuzzyMatch(query: string, text: string): FuzzyResult {
  if (!query) return { match: true, indices: [] };

  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const indices: number[] = [];
  let qi = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      qi++;
    }
  }

  return qi === q.length ? { match: true, indices } : { match: false, indices: [] };
}

export function highlightByIndices(
  text: string,
  indices: number[],
): Array<{ text: string; match: boolean }> {
  if (indices.length === 0) return [{ text, match: false }];

  const set = new Set(indices);
  const parts: Array<{ text: string; match: boolean }> = [];
  let i = 0;

  while (i < text.length) {
    const isMatch = set.has(i);
    let j = i + 1;
    while (j < text.length && set.has(j) === isMatch) j++;
    parts.push({ text: text.slice(i, j), match: isMatch });
    i = j;
  }

  return parts;
}
