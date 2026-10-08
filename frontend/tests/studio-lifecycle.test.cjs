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
    ['components/layout/SidebarNav.tsx', 'SidebarNav'],
    ['components/configuration/ConfigPanel.tsx', 'ConfigPanel'],
    ['components/preview/DataPreviewCanvas.tsx', 'DataPreviewCanvas'],
    ['components/schema/SchemaInspector.tsx', 'SchemaInspector'],
    ['components/quality/QualityDashboard.tsx', 'QualityDashboard'],
  ]) mocks.set(path.join(root, file), { [name]: () => null });
  function load(filename) {
    if (mocks.has(filename)) return mocks.get(filename);
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
  const generate = h.renderer.root.findAllByType('button').find((button) =>
    button.findAllByType('span').some((span) => span.props.children === 'Generate Invoices from Current Dataset'));
  assert.equal(generate.props.disabled, true);
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
});
