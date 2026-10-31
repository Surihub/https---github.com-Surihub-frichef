import assert from 'node:assert/strict';
import test from 'node:test';
import { naverMapUrl, parseNaverShare, requestedPlace, cityDistrict } from '../services/placeFormat.js';
import { handler, meta } from '../netlify/functions/place-preview.mjs';

test('Naver shared text keeps the exact business name, address and link', () => {
  const parsed = parseNaverShare('[네이버지도]\n작은피자집\n서울 동작구 동작대로1길 31 2층 작은피자집\nhttps://naver.me/FJOmpIU6');
  assert.equal(parsed.mapUrl, requestedPlace.mapUrl);
  assert.equal(parsed.dishName, requestedPlace.dishName);
  assert.equal(parsed.address, '서울 동작구');
  assert.equal(requestedPlace.notes, '금요일 오픈런');
});

test('Preview and stored map links reject unexpected hosts, schemes, credentials and ports', () => {
  for (const url of ['http://naver.me/test', 'https://naver.me.evil.example/a', 'https://127.0.0.1/', 'https://user:password@naver.me/a', 'https://naver.me:8443/a', 'javascript:alert(1)']) assert.equal(naverMapUrl(url), null);
  assert.equal(naverMapUrl(requestedPlace.mapUrl), requestedPlace.mapUrl);
});

test('Open Graph parsing supports either attribute order and HTML entities', () => {
  assert.equal(meta('<meta content="https://a.pstatic.net/a?a=1&amp;b=2" property="og:image">', 'og:image'), 'https://a.pstatic.net/a?a=1&b=2');
});

test('Preview never follows a redirect outside Naver', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/' } }); };
  try {
    assert.equal((await handler({ queryStringParameters: { url: requestedPlace.mapUrl } })).statusCode, 502);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('Preview returns Naver image metadata without requiring client-side cross-origin access', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('<meta property="og:title" content="작은피자집"><meta property="og:image" content="https://ssl.pstatic.net/place.jpg">');
  try {
    const result = await handler({ queryStringParameters: { url: requestedPlace.mapUrl } });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body), { title: '작은피자집', imageUrl: 'https://ssl.pstatic.net/place.jpg' });
  } finally { globalThis.fetch = original; }
});

 test('Addresses show only city and district, including previously saved full addresses', () => {
  assert.equal(cityDistrict('서울 동작구 동작대로1길 31 2층 작은피자집'), '서울 동작구');
  assert.equal(cityDistrict('경기도 성남시 분당구 판교로 1'), '경기도 성남시 분당구');
  assert.equal(cityDistrict('서울특별시 강남구 테헤란로 12'), '서울특별시 강남구');
  assert.equal(cityDistrict(''), '');
});

test('Photo extraction ignores the map app icon and uses the first real place image', async () => {
 const { placePhoto } = await import('../netlify/functions/place-preview.mjs');
 assert.equal(placePhoto('<meta property="og:image" content="https://ssl.pstatic.net/static/maps/assets/images/og-map-400x200.png">'), '');
 assert.equal(placePhoto('<meta property="og:image" content="https://ssl.pstatic.net/static/maps/assets/images/og-map-400x200.png"><img src="https://ldb-phinf.pstatic.net/first.jpg"><img src="https://ldb-phinf.pstatic.net/second.jpg">'), 'https://ldb-phinf.pstatic.net/first.jpg');
 assert.equal(placePhoto('<meta property="og:image" content="https://pstatic.net.evil.example/first.jpg">'), '');
});

test('Place metadata follows the public place page for actual photos', async () => {
 const original = globalThis.fetch;
 const calls = [];
 globalThis.fetch = async url => {
  calls.push(url);
  if (calls.length === 1) return new Response('', {status:302,headers:{location:'https://map.naver.com/p/entry/place/1308629361'}});
  if (calls.length === 2) return new Response('<meta property="og:image" content="https://ssl.pstatic.net/static/maps/assets/images/og-map-400x200.png">');
  return new Response('<img src="https://ldb-phinf.pstatic.net/pizza.jpg">');
 };
 try {
  const result = await handler({queryStringParameters:{url:requestedPlace.mapUrl}});
  assert.equal(JSON.parse(result.body).imageUrl, 'https://ldb-phinf.pstatic.net/pizza.jpg');
  assert.equal(calls[2], 'https://pcmap.place.naver.com/place/1308629361/home');
 } finally {globalThis.fetch = original;}
});
