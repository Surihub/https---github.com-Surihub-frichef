import assert from 'node:assert/strict';
import test from 'node:test';
import { sameRecord } from '../services/recordEquality.js';

test('Identical Firestore map content does not conflict when field order changes', () => {
 assert.equal(sameRecord({id:1, notes:'금요일 오픈런', tags:['식사'], metadata:{a:1,b:2}}, {metadata:{b:2,a:1},tags:['식사'],notes:'금요일 오픈런',id:1}), true);
});
test('Concurrent edits and deletions still cause a conflict', () => {
 const original = {id:1,notes:'원본',tags:['식사','간식']};
 assert.equal(sameRecord(original,{...original,notes:'가족 수정'}),false);
 assert.equal(sameRecord(original,{...original,tags:['간식','식사']}),false);
 assert.equal(sameRecord(original,undefined),false);
});
