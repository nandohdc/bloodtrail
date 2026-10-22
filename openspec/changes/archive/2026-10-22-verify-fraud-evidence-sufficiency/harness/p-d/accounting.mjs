export function caseCounts({ observations, predictions }) {
  const counts = new Map(Object.entries(predictions).map(([id, predicted]) => [id, { predicted, observed: 0 }]));
  for (const process of observations) {
    for (const call of process.ledger.calls) {
      const id = call.label.split(":")[0];
      if (counts.has(id)) counts.get(id).observed += 1;
    }
  }
  return counts;
}

export function countResult({ result, counts }) {
  const calls = counts.get(result.case_id);
  if (calls.observed !== calls.predicted) {
    result.notes.push(`${result.case_id} calls: observed ${calls.observed}; predicted ${calls.predicted} (within process allowance unless separately invalidated)`);
    result.matched = false;
  }
  return { ...result, calls };
}
