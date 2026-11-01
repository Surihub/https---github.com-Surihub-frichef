import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationContents, conversationReply } from '../services/conversation.js';

test('Follow-up requests retain ingredients, previous suggestions and rejected dishes', () => {
 const first = {reply:'두부덮밥은 어떠세요?'};
 const contents = conversationContents([{role:'user',text:'두부랑 계란 있어요'},{role:'model',text:first.reply,modelText:JSON.stringify(first)},{role:'user',text:'그건 싫어요. 밥 없이요'}]);
 assert.equal(contents.length,3);
 assert.equal(contents[0].parts[0].text,'두부랑 계란 있어요');
 assert.equal(JSON.parse(contents[1].parts[0].text).reply,first.reply);
 assert.match(contents[2].parts[0].text,/그건 싫어요/);
});
test('A failed turn can be retried or followed up without invalid adjacent user roles', () => {
 const history=[{role:'user',text:'계란 있어요'},{role:'user',text:'10분 안에요'}];
 const result=conversationContents(history);
 assert.equal(result.length,1);assert.match(result[0].parts[0].text,/계란 있어요\n\n10분 안에요/);
 assert.equal(history[0].text,'계란 있어요');
});
test('Suggestions do not fabricate a ready-to-save recipe', () => {
 const reply=conversationReply('{"reply":"계란찜이나 두부구이는 어떠세요?"}');
 assert.equal(reply.recipe,null);assert.match(reply.text,/계란찜/);
});
test('A selected recipe is converted to the existing editable and saveable format', () => {
 const result=conversationReply(JSON.stringify({reply:'두부구이로 준비해볼게요.',recipe:{dishName:'두부구이',ingredients:[{name:'두부',quantity:'150g'},{name:'식용유',quantity:'1작은술'}],steps:['두부 썰기','노릇하게 굽기[[중불]]'],time:'10분'}}));
 assert.deepEqual(result.recipe.ingredients,['두부 150g','식용유 1작은술']);
 assert.equal(result.recipe.formatVersion,3);assert.equal(result.recipe.id,undefined);
 assert.equal(JSON.parse(result.modelText).recipe.dishName,'두부구이');
});
test('Malformed responses or recipes with missing quantities are rejected', () => {
 assert.throws(()=>conversationReply('{"reply":""}'));
 assert.throws(()=>conversationReply(JSON.stringify({reply:'준비했어요',recipe:{dishName:'계란찜',ingredients:[{name:'계란',quantity:''}],steps:['익히기[[약불]]']}})));
});

test('Minor model formatting drift preserves the recipe and cooking times', () => {
 const result=conversationReply(JSON.stringify({reply:'두부구이로 해볼게요.',recipe:{dishName:'두부구이',ingredients:[{name:'두부',quantity:'150g'},{name:'식용유',quantity:'1작은술'}],steps:['식용유 1작은술 넣습니다','두부 150g 넣고 3분 볶습니다[[중불]]']}}));
 assert.deepEqual(result.recipe.ingredients,['두부 150g','식용유 1작은술']);
 assert.deepEqual(result.recipe.steps,['식용유 넣기','두부 넣고 3분 볶기[[중불]]']);
});

test('Heat labels generated in the middle of a step are normalized for the recipe viewer',()=>{
 const result=conversationReply(JSON.stringify({reply:'만들어볼게요.',recipe:{dishName:'두부구이',ingredients:[{name:'두부',quantity:'150g'}],steps:['팬에 두부 올리고 [[중불]]로 3분 굽기.']}}));
 assert.equal(result.recipe.steps[0],'팬에 두부 올리고 3분 굽기[[중불]]');
});
