export const splitLines = value => value.split('\n').map(line => line.trim()).filter(Boolean);

export const youtubeUrl = value => {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    const id = host === 'youtu.be' ? url.pathname.slice(1).split('/')[0]
      : ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)
        ? (url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|live|embed)\//.test(url.pathname) ? url.pathname.split('/')[2] : null)
        : null;
    return /^[\w-]{11}$/.test(id || '') ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch { return null; }
};

export const compactStep = value => String(value)
  .replace(/해\s*주세요[.!]?/g, '하기')
  .replace(/합니다[.!]?/g, '하기')
  .replace(/넣습니다[.!]?/g, '넣기')
  .replace(/볶습니다[.!]?/g, '볶기')
  .replace(/끓입니다[.!]?/g, '끓이기')
  .replace(/섞습니다[.!]?/g, '섞기')
  .replace(/썹니다[.!]?/g, '썰기');

const amountSource = '(?:\\d+(?:[./]\\d+)?(?:\\s*[~～]\\s*\\d+)?|반)\\s*(?:큰술|작은술|공기|꼬집|스푼|컵|개|장|쪽|대|줌|봉|팩|인분|ml|mL|kg|g|L)|약간|적당량';
export const hasIngredientAmount = value => new RegExp(amountSource).test(value);
export const withoutIngredientAmounts = value => String(value).replace(new RegExp(amountSource, 'g'), '').replace(/[ \t]{2,}/g, ' ').trim();
export const ingredientsWithStepAmounts = recipe => {
  const steps = (recipe.steps || []).join(' ');
  return [...new Set([...(recipe.ingredients || []), ...(recipe.extraNeeded || [])])].map(item => {
    if (hasIngredientAmount(item)) return item;
    const name = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    const match = steps.match(new RegExp(`${name}\\s*(${amountSource})`));
    return match ? `${item} ${match[1].replace(/\s+/g, '')}` : item;
  });
};
export const needsRecipeRepair = recipe => recipe.formatVersion !== 3 && (
  [...(recipe.ingredients || []), ...(recipe.extraNeeded || [])].some(item => !hasIngredientAmount(item))
  || (recipe.steps || []).some(step => /습니다|입니다|줍니다/.test(step) || hasIngredientAmount(step))
);
