export function scoreSample(
  kind: string,
  weight: number,
  floor: number,
  ceiling: number,
  boost: number,
  penalty: number,
  tags: readonly string[],
  strict: boolean,
): number {
  let score = weight;

  if (kind === "primary") {
    if (weight > ceiling) {
      score = ceiling;
    } else if (weight < floor) {
      score = strict ? 0 : floor;
    }
  } else if (kind === "secondary") {
    if (tags.length > 0) {
      score += boost;
    } else {
      score -= penalty;
    }
  }

  for (const tag of tags) {
    if (tag.startsWith("deny:")) {
      if (strict) {
        score -= penalty * 2;
      } else {
        score -= penalty;
      }
    } else if (tag.startsWith("allow:")) {
      if (score < ceiling) {
        score += boost;
      }
    }
  }

  if (score < floor) {
    if (strict) {
      return floor;
    }
    return 0;
  }

  if (score > ceiling) {
    return ceiling;
  }

  return score;
}
