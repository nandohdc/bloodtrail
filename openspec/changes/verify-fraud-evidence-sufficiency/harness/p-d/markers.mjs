// Every recipe is a synthetic marker, assembled only when requested at runtime.
// Fragments deliberately split even the short word/key forms used by the scan.
export const RECIPES = Object.freeze({
  keyHash: { fragments: ["pass", "word", "_", "hash"], length: 13 },
  keyRefresh: { fragments: ["ref", "resh", "_", "to", "ken"], length: 13 },
  bearer16: { fragments: ["Be", "arer", " "], repeat: 16, length: 23 },
  bearer15: { fragments: ["Be", "arer", " "], repeat: 15, length: 22 },
  bearerBroken: { fragments: ["Be", "arer", " ", "xxxx", "+"], repeat: 20, length: 32 },
  key16: { fragments: ["s", "k", "-"], repeat: 16, length: 19 },
  key15: { fragments: ["s", "k", "-"], repeat: 15, length: 18 },
  privateKey: { fragments: ["-----", "BE", "GIN", " ", "PRI", "VATE", " ", "K", "EY", "-----"], length: 27 },
  upperWord: { fragments: ["SYNTHETIC", " ", "SEC", "RET", " ", "MARKER"], length: 23 },
  lowerWord: { fragments: ["synthetic", " ", "sec", "ret", " ", "marker"], length: 23 },
  underscore: { fragments: ["synthetic", "_", "sec", "ret", "_", "user"], length: 21 },
  hyphen: { fragments: ["synthetic", "-", "sec", "ret", "-", "user"], length: 21 },
  pluralValue: { fragments: ["synthetic", " ", "sec", "ret", "s"], length: 17 },
  pluralKey: { fragments: ["sec", "ret", "s"], length: 7 },
  joinedKey: { fragments: ["user", "pass", "word"], length: 12 },
});

export function marker(name) {
  const recipe = RECIPES[name];
  let value = recipe.fragments.join("");
  if (recipe.repeat !== undefined) value += "x".repeat(recipe.repeat);
  return value;
}

export function diagnosticPath({ prefix, recipe }) {
  return `${prefix}/${marker(recipe)}`;
}
