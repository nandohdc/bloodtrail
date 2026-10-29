// Total observation access; missing values never become expected counts.
export function read(value, path) {
  let cursor = value;
  for (const key of path.split(".")) {
    if (cursor == null) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

export function phaseFor({ observed, caseDef }) {
  return read(observed, caseDef.phases[0]);
}

export function arrayCount(value) {
  if (!Array.isArray(value)) return -1;
  return value.length;
}

export function allTrue(values) {
  if (values.length === 0) return false;
  return values.every((v) => v === true);
}

export function hasCount(value, count) {
  if (!Array.isArray(value)) return false;
  return value.length === count;
}

export function insertedInTransaction(record) {
  return allTrue([record.is_transaction === true, record.inserted_is_transaction === true]);
}

export function sinkInserted(host, count) {
  const records = read(host, "sink_records");
  if (!hasCount(records, count)) return false;
  return records.every(insertedInTransaction);
}

export function isDuplicate(record) {
  return read(record, "outcome.kind") === "duplicate";
}
