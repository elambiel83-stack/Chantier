const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const web=path.join(__dirname,'../../web');
async function page(role){
 const dom=new JSDOM(fs.readFileSync(path.join(web,'operations.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/operations.html'});
 const calls=[];let accepted=false;
 const quote={id:'quote-1',revision:2,status:'sent',request:'<img src=x onerror=alert(1)>',destination:'Kolwezi',total_usd:163};
 dom.window.apiCall=async (url,opts={})=>{calls.push({url,...opts});
 if(url==='/auth/me')return {user:{role}};
 if(url==='/btp/directory')return {customers:[{id:'c1',label:'Client RDC'}],vendors:[{id:'v1',label:'Transporteur'}],drivers:[]};
 if(url==='/orders')return {orders:[]};if(url==='/products')return {products:[]};
 if(url==='/btp/quotes'&&opts.method==='POST')return {quote};
 if(url==='/btp/quotes')return {quotes:[quote]};
 if(url==='/btp/missions')return {missions:[]};if(url==='/btp/settlements')return {settlements:[]};
 if(url==='/btp/quotes/quote-1/decision'){accepted=true;return {};}
 if(url==='/btp/quotes/quote-1')return {quote:{...quote,status:accepted?'accepted':'sent'},revisions:[{revision:2,lines:[{description:'Blocs',quantity:100,unit:'pcs'}],terms:'Livraison incluse',total_usd:163,transport_usd:20,valid_until:'2030-01-01'}]};
 throw Error('Unexpected '+url);
 };
 dom.window.eval(fs.readFileSync(path.join(web,'operations.js'),'utf8'));
 await new Promise(r=>setTimeout(r,20));return {dom,calls,doc:dom.window.document};
}
test('customer quote UI escapes content and accepts the displayed version',async()=>{
 const {dom,doc,calls}=await page('customer');try{
 assert.equal(doc.getElementById('workspace').hidden,false);
 assert.equal(doc.getElementById('mission-form').hidden,true);
 assert.equal(doc.querySelector('[data-tab="settlements"]').hidden,true);
 assert.equal(doc.querySelector('#quotes-list img'),null);
 doc.querySelector('[data-action="quote"]').click();await new Promise(r=>setTimeout(r,20));
 doc.querySelector('[data-decision="accepted"]').click();await new Promise(r=>setTimeout(r,20));
 assert.deepEqual(JSON.parse(JSON.stringify(calls.find(x=>x.url.endsWith('/decision')).body)),{expectedRevision:2,decision:'accepted'});
 assert.equal(doc.querySelector('[data-decision]'),null);
 }finally{dom.window.close();}
});
test('admin request form uses directory labels and sends selected customer',async()=>{
 const {dom,doc,calls}=await page('admin');try{
 assert.equal(doc.getElementById('stock-form').hidden,false);
 assert.match(doc.getElementById('request-customer').textContent,/Client RDC/);
 doc.getElementById('request-customer').value='c1';doc.getElementById('request-text').value='100 blocs';doc.getElementById('request-destination').value='Kolwezi';
 doc.getElementById('request-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(r=>setTimeout(r,20));
 const sent=calls.find(x=>x.url==='/btp/quotes'&&x.method==='POST');assert.ok(sent);assert.equal(sent.body.customerId,'c1');assert.equal(sent.body.request,'100 blocs');
 }finally{dom.window.close();}
});
test('carrier interface opens assigned missions and hides quote creation',async()=>{
 const {dom,doc}=await page('vendor');try{
 assert.equal(doc.getElementById('request-form').hidden,true);
 assert.equal(doc.querySelector('[data-tab="quotes"]').hidden,true);
 assert.equal(doc.getElementById('missions-panel').hidden,false);
 assert.equal(doc.getElementById('settlement-form').hidden,true);
 }finally{dom.window.close();}
});
