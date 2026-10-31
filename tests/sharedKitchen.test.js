import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { mergeKitchenItems, sharedWorkspaceId } from '../services/sharedKitchen.js';

const plain = value => JSON.parse(JSON.stringify(value));
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve)); };

// Exercise the actual hook with two isolated React lifecycles and an atomic,
// realtime Firestore double. No Firebase credentials or production writes.
function database(initial) {
  const records = new Map(Object.entries(plain(initial)));
  const listeners = new Set();
  let revision = 0;
  let rejectWrites = false;
  const snapshot = id => ({ id, exists: () => records.has(id), data: () => plain(records.get(id)) });
  const value = ref => ref.kind === 'query'
    ? { docs: [...records.keys()].filter(id => records.get(id).sharedWith?.includes(ref.email)).map(snapshot) }
    : snapshot(ref.id);
  const publish = () => {
    for (const listener of listeners) {
      const next = value(listener.ref);
      const signature = JSON.stringify(listener.ref.kind === 'query' ? next.docs.map(item => [item.id, item.data()]) : next.exists() ? next.data() : null);
      if (signature === listener.signature) continue;
      listener.signature = signature;
      queueMicrotask(() => { if (listeners.has(listener)) listener.next(next); });
    }
  };
  const api = {
    collection: () => ({}),
    doc: (_db, _collection, id) => ({ id }),
    where: (_field, _operation, email) => ({ email }),
    query: (_collection, condition) => ({ kind: 'query', email: condition.email }),
    onSnapshot: (ref, next, error) => {
      const listener = { ref, next, error };
      listeners.add(listener); publish();
      return () => listeners.delete(listener);
    },
    runTransaction: async (_db, callback) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const before = revision;
        const writes = [];
        const transaction = {
          get: async ref => {
            assert.equal(writes.length, 0, 'Transactions read before writing');
            return snapshot(ref.id);
          },
          update: (ref, data) => writes.push([ref.id, data, true]),
          set: (ref, data) => writes.push([ref.id, data, false]),
        };
        await callback(transaction);
        if (revision !== before) continue;
        if (rejectWrites && writes.length) throw new Error('permission-denied');
        for (const [id, data, merge] of writes) records.set(id, plain(merge ? { ...records.get(id), ...data } : data));
        if (writes.length) { revision++; publish(); }
        return;
      }
      throw new Error('Too much contention');
    },
    setDoc: async (_ref, data) => {
      records.set(_ref.id, { ...records.get(_ref.id), ...plain(data) }); revision++; publish();
    },
  };
  return {
    api, records,
    denyWrites: () => { rejectWrites = true; },
    failQueries: () => {
      for (const listener of [...listeners]) if (listener.ref.kind === 'query') {
        listeners.delete(listener); listener.error(new Error('permission-denied'));
      }
    },
    get listenerCount() { return listeners.size; },
  };
}

async function client(store, uid, email) {
  const state = [];
  const effects = [];
  let ingredients;
  let recipes;
  const react = {
    useState: initial => {
      const cell = { value: initial }; state.push(cell);
      return [initial, next => { cell.value = typeof next === 'function' ? next(cell.value) : next; }];
    },
    useRef: initial => ({ current: initial }),
    useEffect: callback => effects.push(callback),
  };
  const context = createContext({});
  const module = new SourceTextModule(await readFile(new URL('../hooks/useSharedKitchen.js', import.meta.url), 'utf8'), { context });
  await module.link(async specifier => {
    const exports = specifier === 'react' ? react : specifier === 'firebase/firestore' ? store.api
      : specifier.includes('firebaseClient') ? { db: {} } : { mergeKitchenItems, sharedWorkspaceId };
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  const kitchen = module.namespace.default({ uid, email }, value => { ingredients = plain(value); }, value => { recipes = plain(value); });
  const cleanups = effects.map(effect => effect());
  await settle();
  return {
    kitchen, get recipes() { return recipes; }, get ingredients() { return ingredients; },
    get workspaceId() { return state[0].value; }, get ready() { return state[3].value; }, get error() { return state[4].value; },
    close: () => cleanups.forEach(cleanup => cleanup?.()),
  };
}

const recipe = (id, dishName, extra = {}) => ({ id, dishName, notes: '', ...extra });
const kitchen = (recipes = [], sharedWith = [], ingredients = []) => ({ recipes, sharedWith, ingredients });

test('Invited family automatically uses one document and merges all existing recipe types', async () => {
  const store = database({ owner: kitchen([recipe(1, '계란찜')], ['family@example.com']), family: kitchen([recipe(2, '영상', { type: 'youtube', notes: '간장 줄이기' })], [], [{ id: 1, name: '계란' }]) });
  const owner = await client(store, 'owner', 'owner@example.com');
  const family = await client(store, 'family', 'family@example.com');
  await settle();
  assert.equal(owner.workspaceId, 'owner'); assert.equal(family.workspaceId, 'owner');
  assert.deepEqual(family.recipes, owner.recipes);
  assert.equal(owner.recipes.length, 2); assert.equal(owner.recipes[1].notes, '간장 줄이기');
  assert.deepEqual(owner.ingredients, [{ id: 1, name: '계란' }]);
  assert.deepEqual(store.records.get('family').recipes, []);
  owner.close(); family.close(); assert.equal(store.listenerCount, 0);
});

test('An invitation joins an already logged-in account without manual selection', async () => {
  const store = database({ owner: kitchen([recipe(1, '공유 레시피')]), family: kitchen([recipe(2, '기존 레시피')]) });
  const owner = await client(store, 'owner', 'owner@example.com');
  const family = await client(store, 'family', 'family@example.com');
  await owner.kitchen.invite(' FAMILY@example.com '); await settle();
  assert.equal(family.workspaceId, 'owner'); assert.deepEqual(owner.recipes, family.recipes);
  assert.equal(family.recipes.length, 2);
  owner.close(); family.close();
});

test('Add, update, delete and concurrent edits reach both accounts; deleted recipes stay deleted after login', async () => {
  const store = database({ owner: kitchen([recipe(1, '원본')], ['family@example.com']), family: kitchen([recipe(2, '개인 레시피')]) });
  const owner = await client(store, 'owner', 'owner@example.com');
  const family = await client(store, 'family', 'family@example.com');
  await Promise.all([
    owner.kitchen.mutateRecipes(previous => [...previous, recipe(3, '추가')]),
    family.kitchen.mutateRecipes(previous => previous.map(item => item.id === 1 ? { ...item, notes: '가족 메모' } : item)),
  ]); await settle();
  assert.deepEqual(owner.recipes, family.recipes); assert.equal(owner.recipes.length, 3);
  assert.equal(owner.recipes.find(item => item.id === 1).notes, '가족 메모');
  await family.kitchen.mutateRecipes(previous => previous.filter(item => item.id !== 2)); await settle();
  family.close();
  const again = await client(store, 'family', 'family@example.com'); await settle();
  assert.equal(again.workspaceId, 'owner'); assert.deepEqual(again.recipes, owner.recipes);
  assert.equal(again.recipes.some(item => item.id === 2), false);
  owner.close(); again.close();
});

test('Failed migration keeps both original documents intact and blocks edits', async () => {
  const initial = { owner: kitchen([recipe(1, '공유')], ['family@example.com']), family: kitchen([recipe(2, '개인')]) };
  const store = database(initial); store.denyWrites();
  const family = await client(store, 'family', 'family@example.com');
  assert.equal(family.ready, false); assert.match(family.error, /통합 실패/);
  assert.deepEqual(Object.fromEntries(store.records), initial);
  await assert.rejects(family.kitchen.mutateRecipes(() => []), /연결 대기/);
  family.close();
});

test('Reciprocal invitations converge on the same family store', async () => {
  const store = database({ a: kitchen([recipe(1, 'A')], ['b@example.com']), b: kitchen([recipe(2, 'B')], ['a@example.com']) });
  const a = await client(store, 'a', 'a@example.com');
  const b = await client(store, 'b', 'b@example.com'); await settle();
  assert.equal(a.workspaceId, 'a'); assert.equal(b.workspaceId, 'a');
  assert.deepEqual(a.recipes, b.recipes); assert.equal(a.recipes.length, 2);
  a.close(); b.close();
});

test('Sharing query failure disables writes instead of silently opening a separate personal store', async () => {
  const store = database({ owner: kitchen([recipe(1, '공유')], ['family@example.com']), family: kitchen() });
  const family = await client(store, 'family', 'family@example.com');
  store.failQueries(); await settle();
  assert.equal(family.ready, false); assert.deepEqual(family.recipes, []);
  await assert.rejects(family.kitchen.mutateRecipes(() => []), /연결 대기/);
  family.close();
});

test('ID collisions keep both recipes, including collisions with imported IDs', () => {
  const shared = [recipe(1, '공유'), recipe('import:family:1', '다른 요리')];
  const personal = [recipe(1, '개인')];
  const merged = mergeKitchenItems(shared, personal, 'family');
  assert.deepEqual(merged.map(item => item.dishName), ['공유', '다른 요리', '개인']);
  assert.equal(new Set(merged.map(item => item.id)).size, 3);
  assert.deepEqual(shared.map(item => item.dishName), ['공유', '다른 요리']);
  assert.deepEqual(mergeKitchenItems([recipe(1, '동일')], [recipe(1, '동일')], 'family'), [recipe(1, '동일')]);
});

test('Saved Naver places and Friday notes sync through the same family store', async () => {
  const store = database({ owner: kitchen([], ['family@example.com']), family: kitchen() });
  const owner = await client(store, 'owner', 'owner@example.com');
  const family = await client(store, 'family', 'family@example.com');
  await family.kitchen.mutateRecipes(items => [...items, recipe('place-1', '작은피자집', {
    type: 'place', mapUrl: 'https://naver.me/FJOmpIU6', category: '평일', notes: '금요일 오픈런',
  })]);
  await settle();
  assert.deepEqual(owner.recipes, family.recipes);
  assert.equal(owner.recipes[0].notes, '금요일 오픈런');
  await owner.kitchen.mutateRecipes(items => items.map(item => ({ ...item, notes: '금요일 함께 오픈런' })));
  await settle();
  assert.equal(family.recipes[0].notes, '금요일 함께 오픈런');
  owner.close(); family.close();
});
