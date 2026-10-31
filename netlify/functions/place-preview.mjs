import { naverMapUrl } from '../../services/placeFormat.js';

const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
export function meta(html, property) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(match => [match[1].toLowerCase(), decode(match[2])]));
    if (attrs.property === property || attrs.name === property) return attrs.content || '';
  }
  return '';
}

export async function handler(event) {
  const url = naverMapUrl(event.queryStringParameters?.url);
  if (!url) return { statusCode: 400, body: '네이버지도 링크를 확인해주세요.' };
  try {
    let target = url;
    let response;
    for (let count = 0; count < 5; count++) {
      response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
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
    const candidate = meta(html, 'og:image');
    let imageUrl = '';
    try {
      const image = new URL(candidate);
      if (image.protocol === 'https:' && (image.hostname.endsWith('.pstatic.net') || image.hostname.endsWith('.naver.net'))) imageUrl = image.href;
    } catch {}
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }, body: JSON.stringify({ title: meta(html, 'og:title'), imageUrl }) };
  } catch {
    return { statusCode: 502, body: '미리보기를 불러오지 못했습니다. 장소는 직접 저장할 수 있습니다.' };
  }
}
