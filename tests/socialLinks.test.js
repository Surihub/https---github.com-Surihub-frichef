import assert from 'node:assert/strict';
import test from 'node:test';
import { socialLink, socialItemLink, socialImageUrl } from '../services/socialLinks.js';
import { handler } from '../netlify/functions/social-preview.mjs';

test('Instagram posts and reels normalize without tracking data',()=>{
 assert.deepEqual(socialLink('https://www.instagram.com/reel/Example_123/?igsh=tracking'),{platform:'instagram',url:'https://www.instagram.com/reel/Example_123/'});
 assert.equal(socialLink('https://instagram.com/p/Example/').platform,'instagram');
 assert.equal(socialLink('https://m.instagram.com/reels/Example/').url,'https://www.instagram.com/reel/Example/');
});
test('Existing YouTube bookmarks retain their canonical links',()=>{
 assert.equal(socialItemLink({youtubeUrl:'https://youtu.be/dQw4w9WgXcQ?t=30'}).url,'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});
test('Social previews reject unsupported or deceptive destinations',()=>{
 for(const value of ['https://instagram.com.evil.example/p/a/','http://instagram.com/p/a/','https://user:pass@instagram.com/p/a/','https://127.0.0.1/p/a/','https://www.instagram.com/accounts/login/','https://www.instagram.com/p/a/extra','javascript:alert(1)'])assert.equal(socialLink(value),null);
 assert.equal(socialImageUrl('https://cdninstagram.com.evil.example/photo.jpg'),'');
});
test('Instagram oEmbed returns only safe title and thumbnail metadata',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({title:'간식 레시피',thumbnail_url:'https://scontent.cdninstagram.com/image.jpg',html:'<script>unsafe()</script>'}));
 try {
  const result=await handler({queryStringParameters:{url:'https://www.instagram.com/reel/Example/'}});
  const body=JSON.parse(result.body);
  assert.equal(body.title,'간식 레시피');assert.equal(body.imageUrl,'https://scontent.cdninstagram.com/image.jpg');assert.equal(body.html,undefined);
 }finally{globalThis.fetch=original;}
});
test('Private or unavailable previews still return a usable Instagram link',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response('',{status:403});
 try {
  const result=await handler({queryStringParameters:{url:'https://www.instagram.com/p/Example/'}});
  assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).imageUrl,'');
 }finally{globalThis.fetch=original;}
});
test('YouTube metadata uses the public oEmbed provider',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{assert.ok(url.startsWith('https://www.youtube.com/oembed?'));return new Response(JSON.stringify({title:'계란밥',thumbnail_url:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'}));};
 try{assert.equal(JSON.parse((await handler({queryStringParameters:{url:'https://youtu.be/dQw4w9WgXcQ'}})).body).title,'계란밥');}finally{globalThis.fetch=original;}
});

test('Public Instagram HTML fallback decodes photo URLs and uses the caption headline',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return calls===1?new Response(JSON.stringify({html:'<blockquote>Embed only</blockquote>'})):new Response('<meta property="og:title" content="Creator on Instagram: &quot;Mom&#x2019;s pasta\nIngredients&quot;"><meta property="og:image" content="https://scontent.cdninstagram.com/photo.jpg?a=1&amp;b=2">');};
 try{
  const result=JSON.parse((await handler({queryStringParameters:{url:'https://instagram.com/p/Example/'}})).body);
  assert.equal(result.title,'Mom’s pasta');assert.equal(result.imageUrl,'https://scontent.cdninstagram.com/photo.jpg?a=1&b=2');
 }finally{globalThis.fetch=original;}
});
