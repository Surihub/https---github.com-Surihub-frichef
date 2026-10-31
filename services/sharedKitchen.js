export function sharedWorkspaceId(uid, members = [], invitations = []) {
  // Reciprocal invitations must select the same document on both accounts.
  const candidates = members.length ? [uid, ...invitations] : invitations;
  return [...candidates].sort()[0] || uid;
}

export function mergeKitchenItems(shared = [], personal = [], sourceUid) {
  const result = [...shared];
  personal.forEach((item, index) => {
    const existing = result.find(record => record.id === item.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(item)) return;
    // Older accounts can have the same numeric ID for different recipes.
    let id = existing || item.id == null ? `import:${sourceUid}:${item.id ?? index}` : item.id;
    const imported = result.find(record => record.id === id);
    if (imported && JSON.stringify({ ...imported, id: item.id }) === JSON.stringify(item)) return;
    const prefix = id;
    let suffix = 1;
    while (result.some(record => record.id === id)) id = `${prefix}:${suffix++}`;
    result.push({ ...item, id });
  });
  return result;
}
