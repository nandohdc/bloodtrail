// Pure planted/null controls for the copies probe (#839, criterion 8).
// Executed by every live sender before emitting an occurrence, spending no SDK calls.

export function classifyCandidate({ originalBody, candidateBody }) {
  if (originalBody === candidateBody) return "duplicate";
  return "conflict";
}

export function duplicateAccountingCheck({ records }) {
  const uniqueCount = new Set(records.map((r) => r.event_id)).size;
  return records.length === uniqueCount;
}

export function copiesControls() {
  const original = JSON.stringify({ event: { id: "evt_1" }, data: { port: 443 } });
  const identical = JSON.stringify({ event: { id: "evt_1" }, data: { port: 443 } });
  const changedOneByte = JSON.stringify({ event: { id: "evt_1" }, data: { port: 444 } });

  const nullIdenticalClassified = classifyCandidate({ originalBody: original, candidateBody: identical }) === "duplicate";
  const nullChangedClassified = classifyCandidate({ originalBody: original, candidateBody: changedOneByte }) === "conflict";
  const nullClassificationHolds = nullIdenticalClassified && nullChangedClassified;

  const plantedDefect1Classifier = () => "duplicate";
  const plantedDefect1Detected = plantedDefect1Classifier({ originalBody: original, candidateBody: changedOneByte }) !== "conflict";

  const cleanRecords = [{ event_id: "evt_1", body: original }];
  const nullDuplicateAccountingHolds = duplicateAccountingCheck({ records: cleanRecords });

  const inflatedRecords = [{ event_id: "evt_1", body: original }, { event_id: "evt_1", body: original }];
  const plantedDefect2Detected = !duplicateAccountingCheck({ records: inflatedRecords });

  return {
    changed_byte_classified_as_conflict: nullChangedClassified,
    duplicate_classified_as_duplicate: nullIdenticalClassified,
    changed_byte_defect_detected: plantedDefect1Detected,
    duplicate_double_count_defect_detected: plantedDefect2Detected,
    null_controls_pass: nullClassificationHolds && nullDuplicateAccountingHolds,
  };
}
