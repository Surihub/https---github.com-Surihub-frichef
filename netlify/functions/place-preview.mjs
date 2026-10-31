import { naverMapUrl } from '../../services/placeFormat.js';

const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
export function meta(html, property) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(match => [match[1].toLowerCase(), decode(match[2])]));
    if (attrs.property === property || attrs.name === property) return attrs.content || '';
  }
  return '';
}

export function placePhoto(html) {
  const candidates = [meta(html, 'og:image'), ...((html.replace(/\\\//g, '/').match(/https:\/\/[^\s"'<>\\]+/g)) || [])];
  return candidates.map(decode).find(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !/og-map-|favicon|\/static\//i.test(value)
        && (url.hostname.endsWith('.pstatic.net') || url.hostname.endsWith('.naver.net'))
        && (/^https?:\/\//.test(value))
        && (value === candidates[0] || /phinf|search\.pstatic\.net/.test(url.hostname));
    } catch { return false; }
  }) || '';
}

async function readPage(url) {
  let target = url;
  let response;
  for (let count = 0; count < 5; count++) {
    response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(4000) });
    if (response.status < 300 || response.status >= 400) break;
    const next = naverMapUrl(new URL(response.headers.get('location'), target).href);
    await response.body?.cancel();
    if (!next) throw new Error('Unsupported redirect');
    target = next;
  }
  if (!response?.ok) throw new Error('Preview unavailable');
  let html = '';
  let bytes = 0;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 2_000_000) break;
    html += decoder.decode(chunk, { stream: true });
  }
  return { target, html };
}

export async function handler(event) {
  const url = naverMapUrl(event.queryStringParameters?.url);
  if (!url) return { statusCode: 400, body: '네이버지도 링크를 확인해주세요.' };
  try {
    const page = await readPage(url);
    let imageUrl = placePhoto(page.html);
    const parsed = new URL(page.target);
    const id = parsed.pathname.match(/\/(?:place|restaurant)\/(\d+)/)?.[1] || parsed.searchParams.get('pinId');
    if (!imageUrl && /^\d+$/.test(id || '')) {
      try {
        const detail = await readPage(`https://pcmap.place.naver.com/place/${id}/home`);
        imageUrl = placePhoto(detail.html);
      } catch { /* Do not retry rate limits or substitute the map app icon. */ }
    }
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }, body: JSON.stringify({ title: meta(page.html, 'og:title'), imageUrl }) };
  } catch {
    return { statusCode: 502, body: '미리보기를 불러오지 못했습니다. 장소는 직접 저장할 수 있습니다.' };
  }
}
