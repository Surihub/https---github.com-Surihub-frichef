// Firestore snapshots and transaction reads may enumerate map fields differently.
// Array order is meaningful; object key order is not a content change.
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, ordered(value[key])]));
  return value;
}
export const sameRecord = (left, right) => JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
