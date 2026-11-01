import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

async function conversation() {
 const cells=[], pending=[];let cursor=0,dirty=false,effects=[],scope='owner',current;
 const react={
  useState:initial=>{const index=cursor++;if(!cells[index])cells[index]={value:initial};return[cells[index].value,next=>{cells[index].value=typeof next==='function'?next(cells[index].value):next;dirty=true;}];},
  useRef:initial=>{const index=cursor++;if(!cells[index])cells[index]={value:{current:initial}};return cells[index].value;},
  useEffect:(callback,dependencies)=>{const index=cursor++;const previous=cells[index];if(!previous||dependencies.some((value,i)=>!Object.is(value,previous.dependencies[i]))){cells[index]={dependencies,cleanup:previous?.cleanup};effects.push(()=>{cells[index].cleanup?.();cells[index].cleanup=callback();});}},
 };
 const context=createContext({crypto:{randomUUID}});
 const module=new SourceTextModule(await readFile(new URL('../hooks/useRecipeConversation.js',import.meta.url),'utf8'),{context});
 await module.link(async name=>{const exports=name==='react'?react:{converseRecipe:history=>new Promise((resolve,reject)=>pending.push({history,resolve,reject}))};return new SyntheticModule(Object.keys(exports),function(){for(const[key,value]of Object.entries(exports))this.setExport(key,value);},{context});});
 await module.evaluate();
 const flush=()=>{for(let n=0;n<20;n++){cursor=0;dirty=false;effects=[];current=module.namespace.default(scope);effects.forEach(effect=>effect());if(!dirty)return;}throw new Error('Render did not settle');};
 flush();return{get state(){return current;},pending,flush,switchAccount:value=>{scope=value;flush();}};
}

test('Chat retains all turns and prevents double sends during an API request',async()=>{
 const view=await conversation();const first=view.state.send('두부 있어요');view.flush();
 assert.equal(view.state.busy,true);await view.state.send('중복 요청');assert.equal(view.pending.length,1);
 view.pending[0].resolve({text:'두부구이는 어떠세요?',recipe:null,modelText:'{"reply":"두부구이는 어떠세요?"}'});await first;view.flush();
 const second=view.state.send('그건 싫어요');view.flush();assert.equal(view.pending[1].history.length,3);assert.equal(view.pending[1].history[0].text,'두부 있어요');
 view.pending[1].resolve({text:'두부 달걀전은 어떠세요?',recipe:null});await second;view.flush();assert.equal(view.state.messages.length,4);
});
test('Retry does not duplicate the user message or lose the conversation',async()=>{
 const view=await conversation();const first=view.state.send('계란 있어요');view.pending[0].reject(new Error('network'));await first;view.flush();assert.ok(view.state.error);
 const retry=view.state.retry();assert.equal(view.pending[1].history.length,1);view.pending[1].resolve({text:'계란찜은 어떠세요?',recipe:null});await retry;view.flush();
 assert.equal(view.state.messages.length,2);assert.equal(view.state.error,'');
});
test('Switching accounts clears chat and ignores old in-flight responses',async()=>{
 const view=await conversation();const first=view.state.send('나만의 재료');view.flush();view.switchAccount('family');assert.equal(view.state.messages.length,0);
 view.pending[0].resolve({text:'이전 계정 답변',recipe:null});await first;view.flush();assert.equal(view.state.messages.length,0);assert.equal(view.state.busy,false);
});
