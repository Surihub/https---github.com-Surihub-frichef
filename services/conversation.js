import { compactStep, withoutIngredientAmounts } from '../components/recipeFormat.js';

export function conversationContents(messages) {
  const contents = [];
  for (const message of messages) {
    if (!['user', 'model'].includes(message.role) || !message.text?.trim()) continue;
    const text = message.role === 'model' ? message.modelText || JSON.stringify({ reply: message.text }) : message.text;
    const last = contents.at(-1);
    if (last?.role === message.role) last.parts[0].text += `\n\n${text}`;
    else contents.push({ role: message.role, parts: [{ text }] });
  }
  return contents;
}

export function conversationReply(raw) {
  const value = JSON.parse(raw);
  if (typeof value.reply !== 'string' || !value.reply.trim()) throw new Error('Missing conversational reply');
  let recipe = null;
  if (value.recipe != null) {
    const source = value.recipe;
    if (!source.dishName?.trim() || !Array.isArray(source.ingredients) || !source.ingredients.length || !Array.isArray(source.steps) || !source.steps.length) throw new Error('Incomplete recipe');
    const ingredients = source.ingredients.map(item => {
      if (typeof item.name !== 'string' || !item.name.trim() || typeof item.quantity !== 'string' || !/\d|반|약간|적당량/.test(item.quantity)) throw new Error('Missing quantities');
      return `${item.name.trim()} ${item.quantity.trim()}`;
    });
    if (source.steps.some(step => typeof step !== 'string' || !step.trim())) throw new Error('Invalid compact steps');
    const steps = source.steps.map(step => {
      const heat = step.match(/(?:중\s*약|중\s*강|약|중|강)\s*불/g)?.at(-1)?.replace(/\s/g, '');
      const body = compactStep(withoutIngredientAmounts(step))
        .replace(/\[\[(?:중\s*약|중\s*강|약|중|강)\s*불\]\](?:에서|로)?/g, '')
        .replace(/(?:중\s*약|중\s*강|약|중|강)\s*불(?:에서|로)?/g, '')
        .replace(/[ \t]{2,}/g, ' ').replace(/[.!]+$/, '').trim();
      return heat ? `${body}[[${heat}]]` : body;
    });
    if (steps.some(step => !step)) throw new Error('Empty compact step');
    recipe = { dishName: source.dishName.trim(), ingredients, steps, difficulty: source.difficulty || '', time: source.time || '', proTip: source.proTip || '', extraNeeded: [], notes: '', formatVersion: 3 };
  }
  return { text: value.reply.trim(), recipe, modelText: raw };
}
