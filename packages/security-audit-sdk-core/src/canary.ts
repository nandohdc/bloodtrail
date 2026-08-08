export interface CanarySample {
  readonly kind: string;
  readonly weight: number;
  readonly tags: readonly string[];
}

export function scoreSample(
  sample: CanarySample,
  floor: number,
  ceiling: number,
  boost: number,
  penalty: number,
  strict: boolean,
): number {
  let score = sample.weight;

  if (sample.kind === "primary") {
    if (sample.weight > ceiling) {
      score = ceiling;
    } else if (sample.weight < floor) {
      score = strict ? 0 : floor;
    }
  } else if (sample.kind === "secondary") {
    if (sample.tags.length > 0) {
      score += boost;
    } else {
      score -= penalty;
    }
  }

  for (const tag of sample.tags) {
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
