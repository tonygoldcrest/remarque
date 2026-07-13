export function wrapWords(text: string, firstWidth: number, restWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let limit = firstWidth;

  const hardSplit = (word: string) => {
    let rest = word;

    while (rest.length > limit) {
      lines.push(rest.slice(0, limit));
      rest = rest.slice(limit);
      limit = restWidth;
    }

    cur = rest;
  };

  const startLine = (word: string) => {
    if (word.length > limit) {
      hardSplit(word);
    } else {
      cur = word;
    }
  };

  for (const word of words) {
    if (cur === "") {
      startLine(word);
    } else if (cur.length + 1 + word.length <= limit) {
      cur += " " + word;
    } else {
      lines.push(cur);
      cur = "";
      limit = restWidth;

      startLine(word);
    }
  }

  if (cur !== "") {
    lines.push(cur);
  }

  return lines.length ? lines : [""];
}
