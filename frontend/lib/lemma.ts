const IRREGULAR: Record<string, string> = {
  went: "go",
  gone: "go",
  did: "do",
  done: "do",
  had: "have",
  has: "have",
  was: "be",
  were: "be",
  been: "be",
  is: "be",
  are: "be",
  am: "be",
  made: "make",
  took: "take",
  taken: "take",
  came: "come",
  saw: "see",
  seen: "see",
  got: "get",
  gotten: "get",
  gave: "give",
  given: "give",
  found: "find",
  told: "tell",
  said: "say",
  left: "leave",
  felt: "feel",
  kept: "keep",
  brought: "bring",
  bought: "buy",
  thought: "think",
  taught: "teach",
  caught: "catch",
  ran: "run",
  sat: "sit",
  stood: "stand",
  held: "hold",
  heard: "hear",
  met: "meet",
  paid: "pay",
  sent: "send",
  built: "build",
  spent: "spend",
  lost: "lose",
  meant: "mean",
  led: "lead",
  wrote: "write",
  written: "write",
  spoke: "speak",
  spoken: "speak",
  broke: "break",
  broken: "break",
  chose: "choose",
  chosen: "choose",
  drove: "drive",
  driven: "drive",
  grew: "grow",
  grown: "grow",
  knew: "know",
  known: "know",
  threw: "throw",
  thrown: "throw",
  drew: "draw",
  drawn: "draw",
  flew: "fly",
  flown: "fly",
  wore: "wear",
  worn: "wear",
  rose: "rise",
  risen: "rise",
  fell: "fall",
  fallen: "fall",
  began: "begin",
  begun: "begin",
  woke: "wake",
  woken: "wake",
  won: "win",
  sold: "sell",
  understood: "understand",
  children: "child",
  men: "man",
  women: "woman",
  feet: "foot",
  teeth: "tooth",
  mice: "mouse",
  people: "person",
  lives: "life",
  better: "good",
  best: "good",
  worse: "bad",
  worst: "bad",
};

/**
 * 生成一个词的所有可能原形候选，按可信度排序（首个总是小写原词）。
 * 纯规则实现，覆盖常见的名词复数、动词过去式/进行时/三单、形容词比较级和 -ly 副词。
 */
export function lemmaCandidates(raw: string): string[] {
  const word = raw.toLowerCase().replace(/^'+|'+$/g, "");
  const out: string[] = [];
  const push = (candidate: string) => {
    if (candidate.length >= 2 && !out.includes(candidate)) out.push(candidate);
  };

  push(word);

  if (IRREGULAR[word]) push(IRREGULAR[word]);
  if (word.endsWith("'s")) push(word.slice(0, -2));

  // 复数 / 动词三单
  if (word.endsWith("ies") && word.length > 4) push(`${word.slice(0, -3)}y`);
  if (word.endsWith("es") && word.length > 3) {
    push(word.slice(0, -2));
    push(word.slice(0, -1));
  } else if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) {
    push(word.slice(0, -1));
  }

  // 过去式 / 过去分词
  if (word.endsWith("ied") && word.length > 4) push(`${word.slice(0, -3)}y`);
  if (word.endsWith("ed") && word.length > 3) {
    const stem = word.slice(0, -2);
    push(stem);
    push(word.slice(0, -1));
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) push(stem.slice(0, -1));
  }

  // 进行时
  if (word.endsWith("ing") && word.length > 4) {
    const stem = word.slice(0, -3);
    push(stem);
    push(`${stem}e`);
    if (stem.length >= 3 && stem[stem.length - 1] === stem[stem.length - 2]) push(stem.slice(0, -1));
  }

  // 比较级 / 最高级 / -ly 副词
  if (word.endsWith("ier") && word.length > 4) push(`${word.slice(0, -3)}y`);
  if (word.endsWith("iest") && word.length > 5) push(`${word.slice(0, -4)}y`);
  if (word.endsWith("er") && word.length > 3) {
    push(word.slice(0, -2));
    push(word.slice(0, -1));
  }
  if (word.endsWith("est") && word.length > 4) {
    push(word.slice(0, -3));
    push(word.slice(0, -2));
  }
  if (word.endsWith("ly") && word.length > 4) {
    push(word.slice(0, -2));
    if (word.endsWith("ily")) push(`${word.slice(0, -3)}y`);
  }

  return out;
}

/** 在一个词集合里查找该词（或其原形），返回命中的集合内词条，未命中返回 null。 */
export function resolveInSet(raw: string, set: Set<string>): string | null {
  for (const candidate of lemmaCandidates(raw)) {
    if (set.has(candidate)) return candidate;
  }
  return null;
}

/** 用任意查询函数依次尝试各候选原形，返回首个命中的键和值。 */
export function resolveWith<T>(raw: string, lookup: (word: string) => T | undefined): { key: string; value: T } | null {
  for (const candidate of lemmaCandidates(raw)) {
    const value = lookup(candidate);
    if (value !== undefined) return { key: candidate, value };
  }
  return null;
}
