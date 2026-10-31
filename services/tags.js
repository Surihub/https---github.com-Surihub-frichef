export function normalizeTags(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).flatMap(value => typeof value === 'string' ? value.split(/[,，\n]/) : []).map(value => value.trim().replace(/^#+/, '').trim()).filter(value => {
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
