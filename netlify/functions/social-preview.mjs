import { socialLink, socialImageUrl } from '../../services/socialLinks.js';
import { meta } from './place-preview.mjs';

async function jsonResponse(url) {
 const response = await fetch(url, {redirect:'error',signal:AbortSignal.timeout(6000)});
 if (!response.ok) throw new Error(`Provider ${response.status}`);
 return response.json();
}

export async function handler(event) {
 const link = socialLink(event.queryStringParameters?.url);
 if (!link) return {statusCode:400,body:'유튜브 또는 인스타그램 게시물·릴스 링크를 입력해주세요.'};
 try {
  let title = '', imageUrl = '';
  if (link.platform === 'youtube') {
   const result = await jsonResponse(`https://www.youtube.com/oembed?url=${encodeURIComponent(link.url)}&format=json`);
   title = result.title || ''; imageUrl = socialImageUrl(result.thumbnail_url);
  } else {
   // Public oEmbed metadata only; never forward a user's cookies or render embed HTML.
   const endpoint = new URL('https://graph.facebook.com/v26.0/instagram_oembed');
   endpoint.searchParams.set('url',link.url); endpoint.searchParams.set('omitscript','true');
   if (process.env.INSTAGRAM_OEMBED_TOKEN) endpoint.searchParams.set('access_token',process.env.INSTAGRAM_OEMBED_TOKEN);
   try {
    const result = await jsonResponse(endpoint.href);
    title = result.title || result.author_name || '';
    imageUrl = socialImageUrl(result.thumbnail_url);
   } catch (error) {
    if (error.message.includes('429')) throw error;
   }
   if (!imageUrl) {
    let target = link.url;
    for (let count=0;count<3;count++) {
     const response = await fetch(target,{redirect:'manual',signal:AbortSignal.timeout(5000)});
     if (response.status >= 300 && response.status < 400) {
      const next = socialLink(new URL(response.headers.get('location'),target).href);
      await response.body?.cancel();
      if (!next || next.platform !== 'instagram') break;
      target = next.url; continue;
     }
     if (!response.ok) break;
     let html='', size=0; const decoder=new TextDecoder();
     for await (const chunk of response.body) {size+=chunk.length;if(size>1_000_000)break;html+=decoder.decode(chunk,{stream:true});}
     imageUrl = socialImageUrl(meta(html,'og:image'));
     const candidate = meta(html,'og:title');
     if (imageUrl && candidate && !/^Instagram\s*$/i.test(candidate)) title = candidate.replace(/^.*?on Instagram:\s*["“]/i,'').split(/\r?\n/)[0].replace(/["”]$/,'').trim();
     break;
    }
   }
  }
  return {statusCode:200,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=900'},body:JSON.stringify({platform:link.platform,url:link.url,title:title.slice(0,200),imageUrl})};
 } catch {return {statusCode:502,body:'미리보기를 불러오지 못했습니다. 이름을 입력해 링크를 저장할 수 있습니다.'};}
}
