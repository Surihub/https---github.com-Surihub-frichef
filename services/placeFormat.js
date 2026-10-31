export function naverMapUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return ['naver.me', 'map.naver.com', 'm.map.naver.com', 'm.place.naver.com', 'place.naver.com', 'pcmap.place.naver.com'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

export function parseNaverShare(text) {
  const lines = text.split('\n').map(value => value.trim()).filter(Boolean);
  const link = text.match(/https:\/\/[^\s]+/)?.[0] || '';
  const details = lines.filter(value => value !== '[네이버지도]' && !value.startsWith('https://'));
  return { mapUrl: naverMapUrl(link) || '', dishName: details[0] || '', address: cityDistrict(details.slice(1).join(' ')) };
}

export function cityDistrict(value = '') {
  const parts = value.trim().split(/\s+/);
  const region = [];
  for (const part of parts) {
    if (!/^(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)$/.test(part) && !/(?:특별시|광역시|특별자치시|특별자치도|도|시|구|군)$/.test(part)) break;
    region.push(part);
    if (/[구군]$/.test(part)) break;
  }
  return region.join(' ');
}

export const requestedPlace = {
  dishName: '작은피자집', address: '서울 동작구 동작대로1길 31 2층 작은피자집',
  mapUrl: 'https://naver.me/FJOmpIU6', notes: '금요일 오픈런', category: '평일',
};
