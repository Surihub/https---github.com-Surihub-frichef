export function naverMapUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return ['naver.me', 'map.naver.com', 'm.map.naver.com', 'm.place.naver.com', 'place.naver.com'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

export function parseNaverShare(text) {
  const lines = text.split('\n').map(value => value.trim()).filter(Boolean);
  const link = text.match(/https:\/\/[^\s]+/)?.[0] || '';
  const details = lines.filter(value => value !== '[네이버지도]' && !value.startsWith('https://'));
  return { mapUrl: naverMapUrl(link) || '', dishName: details[0] || '', address: details.slice(1).join(' ') };
}

export const requestedPlace = {
  dishName: '작은피자집', address: '서울 동작구 동작대로1길 31 2층 작은피자집',
  mapUrl: 'https://naver.me/FJOmpIU6', notes: '금요일 오픈런', category: '평일',
};
