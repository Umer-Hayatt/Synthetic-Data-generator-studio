// Frozen S10A navigation benchmark. Real React components, fixed transport/state
// fixtures. Measures scripted action count, not a subjective usability percentage.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const column = (name, dtype = 'string') => ({name, dtype, semantic_type: name.endsWith('_id') ? 'id' : 'generic_text',
  nullable: false, null_rate: 0, constraints: {}, outlier_rate: 0, outlier_scale: 5});
const orders = {name:'Orders', row_count:40, primary_key:'order_id', columns:[column('order_id','integer'),
  column('customer_id','integer'),column('amount','float')], foreign_keys:[{column:'customer_id',
  reference_table:'Customers',reference_column:'customer_id',cardinality:'1:N',min_children:4,max_children:4}]};
const customers = {name:'Customers',row_count:10,primary_key:'customer_id',columns:[column('customer_id','integer'),column('customer_name')]};
const rows = Array.from({length:40},(_,i)=>({order_id:i+1,customer_id:i%10+1,customer_name:`Customer ${i%10+1}`,amount:20+i}));
const sourceSpec = {name:'Shop',version:'2.0',locale:'en_US',seed:42,tables:[{...orders, columns:[...orders.columns,column('customer_name')],foreign_keys:[]}],documents:[]};
const tableRows = {'source':rows,'orders':rows.map(({customer_name,...row})=>row),
  'customers':Array.from({length:10},(_,i)=>({customer_id:i+1,customer_name:`Customer ${i+1}`}))};

function text(node) { return typeof node === 'string' || typeof node === 'number' ? String(node) :
  Array.isArray(node) ? node.map(text).join('') : node?.children ? node.children.map(text).join('') : ''; }

async function mount() {
  const cache = new Map();
  let state;
  const api = {
    fetchPreview: async (id,offset=0,limit=25,filter) => {
      const all=tableRows[id] || [];
      const matching=filter ? all.filter(row=>row[filter.column]===filter.value) : all;
      return {dataset_id:id,row_count:matching.length,total_row_count:all.length,rows:matching.slice(offset,offset+limit)};
    },
    getExportUrl:(format,id)=>`/export/${format}/${id}`,
    getArtifactPage:async()=>({rows:[],row_count:0}),
    getArtifactExportUrl:(format,id)=>`/artifacts/${id}/download?format=${format}`,
  };
  const mocks = new Map([[path.join(root,'services/api.ts'),{api}],
    [path.join(root,'context/StudioContext.tsx'),{useStudio:()=>state}]]);
  function load(filename) {
    if (mocks.has(filename)) return mocks.get(filename);
    if (filename.endsWith('.css')) return {__esModule:true,default:new Proxy({}, {get:(_,key)=>String(key)})};
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename,'utf8').replace(/^\uFEFF/,''));
    const module={exports:{}}; cache.set(filename,module.exports);
    const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,
      jsx:ts.JsxEmit.React,esModuleInterop:true},fileName:filename}).outputText;
    const requireLocal = request => {
      if (!request.startsWith('.')) return require(request);
      const base=path.resolve(path.dirname(filename),request);
      const resolved=[base,`${base}.tsx`,`${base}.ts`,`${base}.json`].find(file=>fs.existsSync(file)&&fs.statSync(file).isFile());
      assert.ok(resolved,`Unresolved import ${request}`); return load(resolved);
    };
    vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`,{filename})(requireLocal,module,module.exports);
    return module.exports;
  }
  const {Workspace}=load(path.join(root,'components/layout/Workspace.tsx'));
  function Host() {
    const [activeTab,setActiveTab]=React.useState('preview');
    state={activeTab,setActiveTab,datasetName:'Shop',datasetRevision:1,datasetSpec:sourceSpec,
      activeSource:{id:'input',kind:'upload'},generatedToken:'source',generatedSnapshot:{datasetId:'source',storage:'frame'},
      generatedRowCount:40,generatedColumns:rows[0]&&Object.keys(rows[0]),generatedPreview:rows.slice(0,25),
      referenceToken:'reference',referenceRowCount:40,referenceColumns:Object.keys(rows[0]),referencePreview:rows.slice(0,25),
      previewViewMode:'generated',setPreviewViewMode:()=>{},tableArtifactMap:{},relationalPreviews:{},
      qualityResults:{overall_score:82.4,score_status:'available',synthetic_rows:40,reference_rows:40,columns:[],
        correlation:{columns:[],real_matrix:[],synthetic_matrix:[]},components:{distribution:.824,missingness:1,correlation:null},
        privacy:{status:'At Risk'},integrity:{status:'Passed'}},sensitiveColumns:['customer_name'],inferredSchema:[],
      schemaNotice:null,clearSchemaNotice:()=>{},isGenerating:false,isEvaluatingQuality:false,isAnalyzingRelationships:false,
      buildRelationships:async()=>{},triggerGenerate:async()=>{},triggerQualityEvaluation:async()=>{},updateSpec:()=>{},
      updateGlobalConfig:()=>{},updateColumnConfig:()=>{},error:null,dismissError:()=>{},
      relationshipProposal:{status:'built',ai_status:'available',explanation:'Orders reference their customers.'},
      relationshipResult:{tables:[{...orders,dataset_id:'orders'},{...customers,dataset_id:'customers'}],
        integrity:{lossless:true,source_rows:40,primary_keys_unique:true,orphan_foreign_keys:0,surrogate_key:null}}};
    return React.createElement(Workspace);
  }
  let renderer; await act(async()=>{renderer=create(React.createElement(Host));});
  const buttons=()=>renderer.root.findAllByType('button');
  const findButton=pattern=>buttons().find(button=>pattern.test(text(button)));
  let actions=0;
  async function click(pattern) {
    const button=findButton(pattern); assert.ok(button,`Missing control ${pattern}`);
    assert.ok(!button.props.disabled,`Disabled control ${pattern}`);
    await act(async()=>{await button.props.onClick();}); actions++;
  }
  return {renderer,findButton,click,get actions(){return actions},get state(){return state},text:()=>text(renderer.toJSON()),
    close:async()=>{await act(async()=>renderer.unmount())}};
}

async function main() {
  const output=process.argv[2]; assert.ok(output,'Pass output report path');
  const tasks=[];
  for (const name of ['data','quality','privacy','schema','related table','full export']) {
    const h=await mount();
    try {
      if (name==='data') assert.ok(h.text().includes('order_id'));
      if (name==='quality') {
        if (!h.renderer.root.findAll(node=>node.props['data-testid']==='quality-summary').length) await h.click(/^Synthetic Quality/);
        assert.match(h.text(),/82(?:\.4)?%/);
        assert.ok(h.text().includes('At Risk')||h.text().includes('Needs protection'));
      }
      if (name==='privacy'||name==='schema') {
        const target=name==='privacy'?/^Privacy Settings$/:/^(View \/ Edit Schema|Edit schema)$/;
        if (!h.findButton(target)) await h.click(/^Schema & Privacy$/);
        await h.click(target);
        if (name==='schema'&&!h.text().includes('Dataset Schema (')) await h.click(/^View \/ Edit Schema$/);
        assert.ok(h.renderer.root.findAllByType('h3').some(heading=>
          text(heading).includes(name==='privacy'?'Privacy Settings':'Dataset Schema')));
      }
      if (name==='related table'||name==='full export') {
        if (!h.findButton(/^Customers \(10\)$/)) await h.click(/^Relational$/);
        await h.click(/^Customers \(10\)$/);
        assert.ok(h.text().includes('Customer 1'));
        if (name==='full export') {
          const anchor=h.renderer.root.findAllByType('a').find(a=>a.props.href==='/export/csv/customers');
          assert.ok(anchor,'Complete selected-table export must retain its dataset token');
          // Following the export link is the final user action; do not download in React.
          tasks.push({task:name,actions:h.actions+1}); continue;
        }
      }
      tasks.push({task:name,actions:h.actions});
    } finally {await h.close();}
  }
  const report={metric:tasks.reduce((sum,t)=>sum+t.actions,0),direction:'lower is better',tasks,
    fixture:'40 orders / 10 customers / measured 82.4% quality; fixed transport responses',
    guards:'All task assertions passed; complete export token retained'};
  fs.writeFileSync(output,JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
