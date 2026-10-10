const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');

const root = path.resolve(__dirname, '..');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const spec = (name) => ({ name, version: '1.0', locale: 'en_US', seed: 42,
  tables: [{ name, row_count: 3, primary_key: 'id', columns: [
    { name: 'id', dtype: 'integer', semantic_type: 'id', constraints: { unique: true } },
    { name: 'value', dtype: 'string', semantic_type: 'generic_text', constraints: {} },
  ] }],
});
const generated = (name) => ({ dataset_id: `generated-${name}`, row_count: 3,
  columns: ['id', 'value'], preview: [{ id: 1, value: name }] });
const visibleText = node => typeof node === 'string' || typeof node === 'number' ? String(node) :
  Array.isArray(node) ? node.map(visibleText).join('') : node?.children ? node.children.map(visibleText).join('') : '';
const findButton = (h, name) => h.renderer.root.findAllByType('button').find(button => visibleText(button) === name);

// Load real TSX components with real React hooks. Only backend transports and
// unrelated UI panels are substituted, so requests can finish in any order.
async function mount(t, overrides = {}) {
  const cache = new Map();
  const plans = [];
  const artifactRows = new Map();
  const api = {
    checkHealth: async () => ({ status: 'ok' }),
    promptSpec: async (name) => ({ status: 'review_required', spec: spec(name) }),
    ingestFile: async (file) => ({ dataset_id: `reference-${file.name}`, spec: spec(file.name),
      columns: ['id', 'value'], row_count: 3, preview: [{ id: 1, value: file.name }], schema: [] }),
    generateData: async (data) => generated(data.name),
    evaluateQuality: async () => ({ overall_score: 80 }),
    getArtifact: async (id) => ({ preview: artifactRows.get(id) || [] }),
    getDocumentUrl: () => '/documents/export',
    fetchPreview: async () => ({ rows: [], row_count: 0 }),
    getArtifactPage: async id => ({ rows: artifactRows.get(id) || [], row_count: (artifactRows.get(id) || []).length }),
    getArtifactExportUrl: (format, id) => `/artifacts/${id}/download?format=${format}`,
    buildRelationships: async body => ({ source_dataset_id: body.dataset_id, result: null,
      proposal: { source_dataset_id: body.dataset_id, status: 'unavailable', ai_status: 'no_key',
        explanation: 'AI is unavailable.', entities: [], questions: [] } }),
    getExportUrl: (format, id) => `/export/${format}/${id}`,
    ...overrides.api,
  };
  const v2 = {
    v2Origin: '',
    jsonBody: (body) => ({ method: 'POST', body: JSON.stringify(body) }),
    isTerminal: (status) => ['complete', 'failed', 'cancelled'].includes(status),
    v2Request: async (url, init) => {
      if (url === '/jobs/generate') {
        const plan = JSON.parse(init.body);
        plans.push(plan);
        const keys = [...plan.spec.tables.map((table) => table.name),
          ...(plan.spec.documents || []).map((doc, i) => `document_${i}_${doc.kind}`)];
        const tables = Object.fromEntries(keys.map((key) => [key, `artifact-${plans.length}-${key}`]));
        const manifest = `manifest-${plans.length}`;
        cache.set(manifest, { tables });
        for (const [key, id] of Object.entries(tables)) {
          artifactRows.set(id, key.startsWith('document_') ? [{
            entity_id: 1, entity: { holder_name: `Holder-${plans.length}` },
            opening_balance: '100.00', closing_balance: '100.00', transactions: [],
            lines: [], subtotal: '0.00', tax: '0.00', discount: '0.00', total: '0.00',
          }] : [{ id: 1, value: key }]);
        }
        return { job_id: 'job', status: 'complete', artifacts: [...Object.values(tables), manifest] };
      }
      const id = url.split('/').pop().split('?')[0];
      return { id, format: id.startsWith('manifest-') ? 'json' : 'jsonl', preview: artifactRows.get(id) };
    },
    ...overrides.v2,
  };
  const nativeFetch = global.fetch;
  global.fetch = overrides.fetch || (async (url) => ({ ok: true,
    json: async () => cache.get(url.split('/').at(-2)) }));
  const mocks = new Map([
    [path.join(root, 'services/api.ts'), { api }],
    [path.join(root, 'services/v2.ts'), v2],
  ]);
  for (const [file, name] of [
    ['components/configuration/ConfigPanel.tsx', 'ConfigPanel'],
  ]) mocks.set(path.join(root, file), { [name]: () => null });
  function load(filename) {
    if (mocks.has(filename)) return mocks.get(filename);
    if (filename.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
    const module = { exports: {} };
    cache.set(filename, module.exports);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const localRequire = (request) => {
      if (!request.startsWith('.')) return require(request);
      const base = path.resolve(path.dirname(filename), request);
      const resolved = [base, `${base}.tsx`, `${base}.ts`, `${base}.json`].find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
      assert.ok(resolved, `Unresolved import ${request}`);
      return load(resolved);
    };
    vm.runInThisContext(`(function(require, module, exports) {${compiled}\n})`, { filename })(localRequire, module, module.exports);
    return module.exports;
  }
  const { StudioProvider, useStudio } = load(path.join(root, 'context/StudioContext.tsx'));
  const { Workspace } = load(path.join(root, 'components/layout/Workspace.tsx'));
  let state;
  function Probe() { state = useStudio(); return React.createElement(Workspace); }
  let renderer;
  await act(async () => { renderer = create(React.createElement(StudioProvider, null, React.createElement(Probe))); });
  t.after(async () => { await act(async () => renderer.unmount()); global.fetch = nativeFetch; });
  return { get state() { return state; }, renderer, api, plans };
}

test('one table keeps settings beside data and never invents reference quality', async t => {
  const h = await mount(t, { api: {
    fetchPreview: async () => ({ rows: [{id: 1, value: 'Current'}], row_count: 3 }),
    evaluateQuality: async () => ({ overall_score: 99, score_status: 'available' }),
  } });
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  assert.match(visibleText(h.renderer.toJSON()), /No reference/);
  assert.doesNotMatch(visibleText(h.renderer.toJSON()), /99%/);
  assert.equal(h.renderer.root.findAll(node => node.props['aria-label'] === 'Generated tables').length, 0);
  assert.equal(findButton(h, 'Documents'), undefined);
  await act(async () => findButton(h, 'Privacy Settings').props.onClick());
  assert.ok(h.renderer.root.findAllByType('h3').some(node => visibleText(node).includes('Privacy Settings')));
  assert.ok(h.renderer.root.findAllByType('td').some(node => visibleText(node) === 'Current'));
  act(() => h.state.updateGlobalConfig({seed: 90}));
  assert.match(visibleText(h.renderer.toJSON()), /Not generated/);
  assert.equal(h.renderer.root.findAllByType('a').length, 0);
});

test('linked records filter complete parent data and ignore superseded page responses', async t => {
  const requests = [], late = deferred();
  let firstParents = true;
  const child = {...spec('Orders').tables[0], row_count: 70, foreign_keys: [
    {column:'value',reference_table:'Customers',reference_column:'id',cardinality:'1:N'}]};
  const parent = spec('Customers').tables[0];
  const h = await mount(t, { api: {
    buildRelationships: async body => ({source_dataset_id:body.dataset_id,
      proposal:{source_dataset_id:body.dataset_id,status:'built',ai_status:'available'},
      result:{source_dataset_id:body.dataset_id,tables:[{...child,dataset_id:'children'},
        {...parent,dataset_id:'parents'}],integrity:{lossless:true,source_rows:70,primary_keys_unique:true,orphan_foreign_keys:0}}}),
    fetchPreview: async (id,offset,limit,filter) => {
      requests.push({id,offset,limit,filter});
      if (id === 'parents' && !filter && firstParents) {firstParents=false; return late.promise;}
      return {rows:[{id:offset+1,value:id==='children'?3:'Parent 3'}],row_count:filter?1:70,total_row_count:70};
    },
  } });
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  await act(async () => findButton(h, 'Next').props.onClick());
  assert.ok(requests.some(request => request.id==='children' && request.offset===25));
  await act(async () => findButton(h, 'Customers (3)').props.onClick());
  await act(async () => findButton(h, 'Orders (70)').props.onClick());
  const link=h.renderer.root.findAllByType('button').find(node=>node.props['aria-label']==='Open Customers record for value 3');
  await act(async () => link.props.onClick());
  assert.deepEqual(requests.at(-1).filter,{column:'id',value:3,from:'Orders'});
  assert.match(visibleText(h.renderer.toJSON()), /1 matching rows/);
  assert.ok(h.renderer.root.findAllByType('a').some(node=>node.props.href==='/export/csv/parents'));
  await act(async () => late.resolve({rows:[{id:999,value:'STALE'}],row_count:70}));
  assert.doesNotMatch(visibleText(h.renderer.toJSON()), /STALE/);
});

test('new prompt clears demo artifacts immediately and retains its prompt and snapshot identity', async (t) => {
  const h = await mount(t);
  await act(async () => { await h.state.loadBankingRelational(); });
  const oldSource = h.state.activeSource.id;
  assert.equal(h.state.activeSource.kind, 'demo');
  assert.ok(h.state.documentManifestId);
  const wait = deferred();
  h.api.promptSpec = () => wait.promise;
  let pending;
  act(() => { pending = h.state.loadFromAiPrompt('students with grades'); });
  assert.equal(h.state.activeSource.kind, 'prompt');
  assert.equal(h.state.activeSource.prompt, 'students with grades');
  assert.notEqual(h.state.activeSource.id, oldSource);
  assert.equal(h.state.generatedToken, null);
  assert.equal(h.state.documentManifestId, null);
  assert.equal(h.state.generatedSnapshot, null);
  assert.deepEqual(h.state.tableArtifactMap, {});
  assert.deepEqual(h.state.relationalPreviews, {});
  await act(async () => { wait.resolve({ status: 'review_required', spec: spec('Students') }); await pending; });
  assert.equal(h.state.generatedToken, 'generated-Students');
  assert.equal(h.state.generatedSnapshot.sourceId, h.state.activeSource.id);
  assert.equal(h.state.generatedSnapshot.revision, h.state.datasetRevision);
  assert.equal(h.state.generatedSnapshot.storage, 'frame');
});

test('relationship normalization uses the retained full snapshot and keeps original tabular state', async (t) => {
  const requests = [];
  const h = await mount(t, { api: {
    analyzeRelationships: async body => { requests.push(body); return { source_dataset_id: body.dataset_id, entities: [], questions: [] }; },
    normalizeRelationships: async body => { requests.push(body); return { source_dataset_id: body.dataset_id, tables: [],
      integrity: { lossless: true, source_rows: 3, orphan_foreign_keys: 0, primary_keys_unique: true }, spec: spec('Normalized') }; },
  } });
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  const originalSpec = h.state.datasetSpec, snapshot = h.state.generatedSnapshot;
  await act(async () => { assert.equal(await h.state.analyzeRelationships(), true); });
  await act(async () => { assert.equal(await h.state.acceptRelationships([{ name: 'People', key: 'id', columns: ['value'] }]), true); });
  assert.equal(requests[0].dataset_id, snapshot.datasetId);
  assert.equal(requests[0].prompt, 'Current');
  assert.equal(h.state.datasetSpec, originalSpec);
  assert.equal(h.state.generatedSnapshot, snapshot);
  assert.equal(h.state.generatedToken, snapshot.datasetId);
  assert.ok(h.state.relationshipResult.integrity.lossless);
  act(() => h.state.updateGlobalConfig({ seed: 99 }));
  assert.equal(h.state.relationshipResult, null);
  assert.equal(h.state.relationshipProposal, null);
});

test('superseded relationship analysis and normalization cannot publish stale output', async (t) => {
  const first = deferred(), last = deferred(), normalized = deferred();
  let calls = 0;
  const h = await mount(t, { api: { analyzeRelationships: () => ++calls === 1 ? first.promise : last.promise,
    normalizeRelationships: () => normalized.promise } });
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  let old, current;
  act(() => { old = h.state.analyzeRelationships(); });
  act(() => { current = h.state.analyzeRelationships('clearer'); });
  await act(async () => { first.resolve({ source_dataset_id: 'generated-Current', entities: [] }); assert.equal(await old, false); });
  assert.equal(h.state.isAnalyzingRelationships, true);
  await act(async () => { last.resolve({ source_dataset_id: 'generated-Current', entities: [], questions: [] }); assert.equal(await current, true); });
  let pending;
  act(() => { pending = h.state.acceptRelationships([]); });
  await act(async () => { await h.state.loadFromAiPrompt('New'); });
  await act(async () => { normalized.resolve({ source_dataset_id: 'generated-Current' }); assert.equal(await pending, false); });
  assert.equal(h.state.relationshipResult, null);
  assert.equal(h.state.relationshipProposal?.source_dataset_id, 'generated-New');
  assert.equal(h.state.generatedToken, 'generated-New');
});

test('opening relational builds with AI once, keeps the source and does not require manual mapping', async (t) => {
  let calls = 0;
  const previews = [];
  const h = await mount(t, { api: {
    fetchPreview: async (token, offset) => { previews.push([token, offset]); return { row_count: 30, rows: [{ id: 1, value: 'Current' }] }; },
    buildRelationships: async body => {
      calls++;
      assert.equal(body.dataset_id, 'generated-Current');
      assert.equal(body.prompt, 'Current');
      return { source_dataset_id: body.dataset_id,
        proposal: { source_dataset_id: body.dataset_id, status: 'single_table', ai_status: 'available',
          explanation: 'One entity is represented.', entities: [], questions: [] },
        result: { source_dataset_id: body.dataset_id, spec: spec('Current'),
          tables: [{ ...spec('Current').tables[0], row_count: 30, dataset_id: 'normalized-current' }],
          integrity: { lossless: true, source_rows: 30, orphan_foreign_keys: 0, primary_keys_unique: true } } };
    },
  } });
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  const snapshot = h.state.generatedSnapshot;
  await act(async () => h.state.setActiveTab('relational'));
  assert.equal(calls, 1);
  assert.equal(h.state.generatedSnapshot, snapshot);
  assert.equal(h.renderer.root.findAllByType('textarea').length, 0);
  assert.equal(h.renderer.root.findAllByType('input').filter(i => i.props.type === 'checkbox').length, 0);
  await act(async () => { h.renderer.root.findAllByType('button').find(b => b.props.children === 'Next').props.onClick(); });
  assert.deepEqual(previews.at(-1), ['normalized-current', 25]);
  await act(async () => h.state.setActiveTab('preview'));
  await act(async () => h.state.setActiveTab('relational'));
  assert.equal(calls, 1);
});

test('a late automatic AI build cannot restore another snapshot', async (t) => {
  const wait = deferred();
  const h = await mount(t, { api: { buildRelationships: () => wait.promise } });
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  let pending;
  act(() => { pending = h.state.buildRelationships(); });
  await act(async () => { await h.state.loadFromAiPrompt('New'); });
  await act(async () => { wait.resolve({ source_dataset_id: 'generated-Current',
    proposal: { source_dataset_id: 'generated-Current' }, result: null }); assert.equal(await pending, false); });
  assert.equal(h.state.relationshipProposal, null);
  assert.equal(h.state.relationshipResult, null);
  assert.equal(h.state.generatedToken, 'generated-New');
});

test('AI failure remains a retryable failure and does not loop or ask for mapping', async (t) => {
  let calls = 0;
  const h = await mount(t, { api: { buildRelationships: async body => {
    calls++;
    return { source_dataset_id: body.dataset_id, result: null, proposal: {
      source_dataset_id: body.dataset_id, status: 'unavailable', ai_status: 'invalid_request',
      explanation: 'The original table is retained.', entities: [], questions: [] } };
  } } });
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  await act(async () => h.state.setActiveTab('relational'));
  assert.equal(calls, 1);
  assert.equal(h.state.relationshipResult, null);
  assert.equal(h.renderer.root.findAllByType('textarea').length, 0);
  assert.match(JSON.stringify(h.renderer.toJSON()), /provider rejected the model request/);
  await act(async () => h.renderer.root.findAllByType('button').find(b => b.props.children === 'Retry relationships').props.onClick());
  assert.equal(calls, 2);
});

test('an older ingestion cannot overwrite a newer prompt or launch its generation', async (t) => {
  const upload = deferred();
  const h = await mount(t, { api: { ingestFile: () => upload.promise } });
  let old;
  act(() => { old = h.state.handleFileUpload({ name: 'old.csv' }); });
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  await act(async () => { upload.resolve({ dataset_id: 'old', spec: spec('Old'), columns: [], schema: [] }); assert.equal(await old, false); });
  assert.equal(h.state.datasetName, 'Current');
  assert.equal(h.state.referenceToken, null);
  assert.equal(h.state.generatedToken, 'generated-Current');
});

test('older generation errors and finalizers do not affect the current pending request', async (t) => {
  const a = deferred(), b = deferred();
  const h = await mount(t, { api: { generateData: (data) => data.name === 'A' ? a.promise : b.promise } });
  let old, current;
  await act(async () => { old = h.state.loadFromAiPrompt('A'); });
  await act(async () => { current = h.state.loadFromAiPrompt('B'); });
  await act(async () => { a.reject(new Error('old failure')); assert.equal(await old, false); });
  assert.equal(h.state.error, null);
  assert.equal(h.state.isGenerating, true);
  assert.equal(h.state.isIngesting, true);
  await act(async () => { b.resolve(generated('B')); await current; });
  assert.equal(h.state.generatedToken, 'generated-B');
});

test('late quality results are ignored after model edits and source identity is retained', async (t) => {
  const quality = deferred();
  const h = await mount(t, { api: { evaluateQuality: () => quality.promise } });
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  const source = h.state.activeSource;
  const revision = h.state.datasetRevision;
  act(() => h.state.updateGlobalConfig({ seed: 99 }));
  assert.deepEqual(h.state.activeSource, source);
  assert.ok(h.state.datasetRevision > revision);
  assert.equal(h.state.generatedToken, null);
  await act(async () => quality.resolve({ overall_score: 99 }));
  assert.equal(h.state.qualityResults, null);
  assert.equal(h.state.datasetSpec.seed, 99);
});

test('a late multi-table manifest cannot restore artifacts after a new upload', async (t) => {
  const manifest = deferred();
  const h = await mount(t, { fetch: () => manifest.promise });
  let old;
  await act(async () => { old = h.state.loadBankingRelational(); });
  await act(async () => { await h.state.handleFileUpload({ name: 'new.csv' }); });
  await act(async () => { manifest.resolve({ ok: true, json: async () => ({ tables: { Accounts: 'old' } }) }); assert.equal(await old, false); });
  assert.equal(h.state.generatedToken, 'generated-new.csv');
  assert.deepEqual(h.state.tableArtifactMap, {});
  assert.equal(h.state.documentManifestId, null);
});

test('ordinary document/relational actions keep the uploaded dataset and submit no demo job', async (t) => {
  const h = await mount(t);
  await act(async () => { await h.state.handleFileUpload({ name: 'sensors.csv' }); });
  const before = h.state.generatedSnapshot;
  await act(async () => { assert.equal(await h.state.generateDocumentsFromSpec(), false); });
  await act(async () => { assert.equal(await h.state.generateRelationalFromSpec(), false); });
  assert.equal(h.plans.length, 0);
  assert.equal(h.state.datasetName, 'sensors');
  assert.deepEqual(h.state.generatedSnapshot, before);
  act(() => h.state.setActiveTab('documents'));
  assert.equal(h.renderer.root.findAllByType('button').some(button => button.props.children === 'Documents'), false);
});

test('model edits clear mounted document previews and downloads before a late preview finishes', async (t) => {
  const preview = deferred();
  const h = await mount(t);
  await act(async () => { await h.state.loadBankingRelational(); });
  assert.ok(h.renderer.root.findAllByType('a').length > 0);
  h.api.getArtifact = () => preview.promise;
  await act(async () => { await h.state.generateDocumentsFromSpec(); });
  act(() => h.state.updateGlobalConfig({ seed: 7 }));
  assert.equal(h.renderer.root.findAllByType('a').length, 0);
  await act(async () => preview.resolve({ preview: [{ entity_id: 'OLD', entity: {}, transactions: [] }] }));
  assert.equal(h.renderer.root.findAllByType('a').length, 0);
  assert.equal(h.state.documentManifestId, null);
});

test('clearing the session invalidates pending prompts and prevents restoring the workspace', async (t) => {
  const response = deferred();
  const h = await mount(t, { api: { promptSpec: () => response.promise } });
  let pending;
  act(() => { pending = h.state.loadFromAiPrompt('Old'); });
  act(() => h.state.clearSession());
  await act(async () => { response.resolve({ status: 'review_required', spec: spec('Old') }); assert.equal(await pending, false); });
  assert.equal(h.state.datasetSpec, null);
  assert.equal(h.state.activeSource, null);
  assert.equal(h.state.generatedSnapshot, null);
  assert.equal(h.state.isIngesting, false);
});

test('batched column and global edits retain both changes without changing source identity', async (t) => {
  const h = await mount(t);
  await act(async () => { await h.state.loadFromAiPrompt('Current'); });
  const sourceId = h.state.activeSource.id;
  act(() => {
    h.state.updateColumnConfig('value', { nullable: true });
    h.state.updateGlobalConfig({ seed: 73 });
  });
  assert.equal(h.state.datasetSpec.tables[0].columns[1].nullable, true);
  assert.equal(h.state.datasetSpec.seed, 73);
  assert.equal(h.state.activeSource.id, sourceId);
  assert.equal(h.state.generatedSnapshot, null);
});

test('a cancelled generation never publishes a manifest or a success snapshot', async (t) => {
  const h = await mount(t, { v2: { v2Request: async () => ({ status: 'cancelled', artifacts: [] }) } });
  await act(async () => { assert.equal(await h.state.loadBankingRelational(), false); });
  assert.match(h.state.error.message, /cancelled/);
  assert.equal(h.state.generatedSnapshot, null);
  assert.equal(h.state.documentManifestId, null);
  assert.deepEqual(h.state.tableArtifactMap, {});
  assert.doesNotMatch(visibleText(h.renderer.toJSON()), /Accounts \(\d+\)/);
});
