import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTags } from '../services/tags.js';

test('Freeform tags preserve user words, accept delimiters and remove duplicates', () => {
 assert.deepEqual(normalizeTags([' #간식 ', '식사,분식', '간식', '데이트\n점심', 'CAFE', 'cafe']), ['간식','식사','분식','데이트','점심','CAFE']);
});
test('Legacy records without tags and malformed values remain readable', () => {
 assert.deepEqual(normalizeTags(), []);
 assert.deepEqual(normalizeTags(null), []);
 assert.deepEqual(normalizeTags(['', '#', 7, null, '혼밥']), ['혼밥']);
});
