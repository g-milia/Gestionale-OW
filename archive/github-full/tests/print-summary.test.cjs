const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixture = require('./summary-fixture.cjs');
const root = path.join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root,'js/ui.js'),'utf8'), context);
const build = context.window.OWUI.buildSummaryPrintHtml;
const style = 'https://example.test/Gestionale-OW/css/print-summary.css?v=test';

test('summary adds a second print button without removing the existing one', () => {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.equal((html.match(/id="pdfBtn"/g)||[]).length, 1);
  assert.equal((html.match(/id="summaryPdfBtn"/g)||[]).length, 1);
  assert.equal((html.match(/id="pdfFrame"/g)||[]).length, 1);
});
test('matches the operational sheet sections and table headings', () => {
  const html = build(fixture(), style);
  for (const text of ['Timeline','Atleti','Ruoli','Note percorso','Luogo / Note','Numeri','Ufficiali gara assegnati','Totale atleti: 135','Partenze: 4']) assert.ok(html.includes(text),text);
  assert.ok(html.includes('summary-top'));
  assert.ok(html.includes(style.replace(/&/g,'&amp;')));
});
test('preserves category, role, timeline and assignment order', () => {
  const state=fixture();
  state.roleCategories.reverse();
  state.roleCategories[0].roles.reverse();
  const html=build(state,style);
  let last=-1;
  for (const category of state.roleCategories) {
    const pos=html.indexOf('. '+category.name,last+1);assert.ok(pos>last);last=pos;
    for(const role of category.roles){const pos=html.indexOf(role.name,last+1);assert.ok(pos>last);last=pos;}
  }
  assert.ok(html.indexOf('Imbarco Giudici')<html.indexOf('Check Radio'));
  state.roleCategories[0].roles[0].officialIds=['u11','u0','u11'];
  assert.ok(build(state,style).includes('Ufficiale dimostrativo 12 - Ufficiale dimostrativo 1'));
});
test('does not mutate state or serialize credentials', () => {
  const state=fixture();state.token='TEST_TOKEN_NOT_FOR_PRINT';state.secret='TEST_SECRET_NOT_FOR_PRINT';
  const before=JSON.stringify(state);const html=build(state,style);
  assert.equal(JSON.stringify(state),before);
  assert.ok(!html.includes(state.token));assert.ok(!html.includes(state.secret));
});
test('escapes text and attributes, including malformed HTML', () => {
  const state=fixture();state.event.name='<img src=x onerror="alert(1)">';
  state.roleCategories[0].name='" onclick="alert(1)';state.event.pathNotes='</div><script>alert(1)</script>';
  const html=build(state,style+'" onload="alert(1)');
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&quot; onload=&quot;'));
});
test('missing lists and zero athletes remain valid', () => {
  const state={event:{athleteTotal:0,athleteDepartures:[{name:'Zero',athletes:0}]}};
  const html=build(state,style);
  assert.ok(html.includes('Totale atleti: 0'));assert.ok(html.includes('Partenze: 1'));
  assert.ok(html.includes('<td>0</td>'));assert.ok(!html.includes('undefined'));
  assert.doesNotThrow(()=>build({},style));
});
test('unknown official IDs are visible instead of silently discarded', () => {
  const state=fixture();state.roleCategories[0].roles[0].officialIds=['missing'];
  assert.ok(build(state,style).includes('UG non presente'));
});
test('long categories retain every row and are allowed to paginate', () => {
  const state=fixture();state.roleCategories[0].roles=Array.from({length:150},(_,i)=>({id:'long'+i,name:'UNIQUE_ROLE_'+i,officialIds:[]}));
  const html=build(state,style);assert.ok(html.includes('long-category'));
  for(let i=0;i<150;i++)assert.ok(html.includes('UNIQUE_ROLE_'+i));
});
