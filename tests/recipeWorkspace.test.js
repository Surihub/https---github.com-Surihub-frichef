import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { transform } from 'esbuild';
import * as recipeFormat from '../components/recipeFormat.js';

// Render the component's actual JSX and effects without a browser or API calls.
async function workspace(recipe, onSave) {
  const cells = [];
  let cursor = 0;
  let dirty = false;
  let effects = [];
  let tree;
  let props = { recipe, onSave, onClose() {} };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const index = cursor++;
      if (!cells[index]) cells[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [cells[index].value, next => {
        const value = typeof next === 'function' ? next(cells[index].value) : next;
        if (!Object.is(value, cells[index].value)) { cells[index].value = value; dirty = true; }
      }];
    },
    useRef: initial => {
      const index = cursor++;
      if (!cells[index]) cells[index] = { value: { current: initial } };
      return cells[index].value;
    },
    useEffect: (callback, dependencies) => {
      const index = cursor++;
      const previous = cells[index];
      if (!previous || dependencies.some((value, index) => !Object.is(value, previous.dependencies[index]))) {
        cells[index] = { dependencies, cleanup: previous?.cleanup };
        effects.push(() => { cells[index].cleanup?.(); cells[index].cleanup = callback(); });
      }
    },
  };
  const context = createContext({
    localStorage: { getItem: () => null, setItem() {} },
    document: { body: { style: {} }, addEventListener() {}, removeEventListener() {} },
  });
  const { code } = await transform(await readFile(new URL('../components/RecipeWorkspace.jsx', import.meta.url), 'utf8'), { loader: 'jsx' });
  const module = new SourceTextModule(code, { context });
  await module.link(async specifier => {
    const exports = specifier === 'react' ? { default: react, ...react } : specifier.includes('recipeFormat') ? recipeFormat
      : { completeIngredientAmounts: async () => [], repairExistingRecipe: async value => value };
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  const render = () => {
    for (let i = 0; i < 20; i++) {
      cursor = 0; dirty = false; effects = [];
      tree = module.namespace.default(props);
      effects.forEach(effect => effect());
      if (!dirty) return;
    }
    throw new Error('Render did not settle');
  };
  const all = (node, predicate) => {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(item => all(item, predicate));
    return [...(predicate(node) ? [node] : []), ...all(node.props?.children, predicate)];
  };
  render();
  return {
    update: recipe => { props = { ...props, recipe }; render(); },
    act: async callback => { await callback(); render(); },
    nodes: type => all(tree, node => node.type === type),
    button: text => all(tree, node => node.type === 'button' && node.props.children.includes(text))[0],
    close: () => cells.forEach(cell => cell.cleanup?.()),
  };
}

const original = { id: 'recipe-1', dishName: '계란찜', ingredients: ['계란 2개'], steps: ['약불에서 익히기'], notes: '원래 메모', formatVersion: 3 };

test('An open recipe immediately displays family edits, including notes', async () => {
  const view = await workspace(original, async () => true);
  view.update({ ...original, dishName: '수정된 요리', notes: '가족 메모' });
  assert.equal(view.nodes('h1')[0].props.children[0], '수정된 요리');
  assert.equal(view.nodes('textarea')[0].props.value, '가족 메모');
  view.close();
});

test('Unsaved notes survive remote edits and use the original notes to detect conflicts', async () => {
  let save;
  const view = await workspace(original, async (draft, options) => { save = { draft, options }; return true; });
  await view.act(() => view.nodes('textarea')[0].props.onChange({ target: { value: '작성 중 메모' } }));
  view.update({ ...original, dishName: '가족이 바꾼 이름', notes: '가족 메모' });
  assert.equal(view.nodes('h1')[0].props.children[0], '가족이 바꾼 이름');
  assert.equal(view.nodes('textarea')[0].props.value, '작성 중 메모');
  await view.act(() => view.button('메모 저장').props.onClick());
  assert.equal(save.draft.notes, '작성 중 메모');
  assert.equal(save.options.expectedNotes, '원래 메모');
  assert.equal(save.options.notesOnly, true);
  view.close();
});

test('Editing retains the original revision so a concurrent full edit cannot overwrite family changes', async () => {
  let options;
  const view = await workspace(original, async (_draft, value) => { options = value; return true; });
  await view.act(() => view.button('수정').props.onClick());
  view.update({ ...original, notes: '다른 가족의 변경' });
  await view.act(() => view.nodes('form')[0].props.onSubmit({ preventDefault() {} }));
  assert.equal(options.expectedRecipe.notes, '원래 메모');
  view.close();
});

test('Newly generated recipes can save without an existing revision', async () => {
  let saved;
  const { id, ...draft } = original;
  const view = await workspace(draft, async (recipe, options) => { saved = { recipe, options }; return true; });
  await view.act(() => view.nodes('form')[0].props.onSubmit({ preventDefault() {} }));
  assert.equal(saved.options.expectedRecipe, undefined);
  assert.equal(saved.recipe.dishName, original.dishName);
  view.close();
});
