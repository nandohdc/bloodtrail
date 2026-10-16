export function compareIds({ left, right }) {
  const rightSet = new Set(right);
  return {
    positional_equality: left.filter((value, index) => index < right.length && value === right[index]).length,
    intersection: new Set(left.filter((value) => rightSet.has(value))).size,
  };
}

export function distinctIds({ arrays }) {
  const values = arrays.flat();
  return { count: values.length, distinct: new Set(values).size, all_distinct: new Set(values).size === values.length };
}
