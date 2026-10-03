const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {JSDOM}=require('jsdom');const web=path.join(__dirname,'../../web');const wait=()=>new Promise(r=>setTimeout(r,25));
const partner={id:'v-123',business_name:'<img src=x onerror=alert(1)>',trade_ids:['transport'],specialties:['Bennes'],zones:['Kolwezi'],description:'Transport de matériaux',availability:'available',references_text:'Chantiers locaux',rate_notes:'Sur devis'};
test('public directory filters safely and links targeted quotes',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(web,'professionals.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/professionals.html'});const calls=[];
 try{dom.window.apiCall=async url=>{calls.push(url);if(url==='/trades')return {trades:[{id:'transport',label:'Transport'}]};if(url.startsWith('/partners?'))return {partners:[partner],hasMore:false};if(url==='/partners/v-123')return {partner};throw Error(url);};dom.window.eval(fs.readFileSync(path.join(web,'professionals.js'),'utf8'));await wait();const d=dom.window.document;
 assert.equal(d.querySelector('#professionals-list img'),null);d.getElementById('filter-trade').value='transport';d.getElementById('filter-zone').value='Kolwezi';d.getElementById('search-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await wait();assert.ok(calls.some(x=>x.includes('trade=transport')&&x.includes('zone=Kolwezi')));
 d.querySelector('[data-partner]').click();await wait();assert.equal(d.querySelector('#professional-detail img'),null);const link=new URL(d.querySelector('#professional-detail a').href);assert.equal(link.searchParams.get('partner'),partner.id);assert.equal(link.searchParams.get('trade'),'transport');
 }finally{dom.window.close();}
});
test('partner profile loads selected trades and saves opt-in publication',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(web,'partner-profile.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/partner-profile.html'});let saved;
 try{dom.window.apiCall=async(url,opts={})=>{
 if(url==='/auth/me')return {user:{role:'vendor'}};if(url==='/trades')return {trades:[{id:'transport',label:'Transport'}]};if(url==='/vendor/quote-requests')return {requests:[]};if(opts.method==='PUT'){saved=opts.body;return {};}
 if(url==='/vendor/profile')return {vendor:{business_name:'Entreprise'},profile:{...partner,published:false}};throw Error(url);
 };dom.window.eval(fs.readFileSync(path.join(web,'partner-profile.js'),'utf8'));await wait();const d=dom.window.document;assert.equal(d.getElementById('profile-form').hidden,false);assert.equal(d.querySelector('[name="trade"]').checked,true);
 d.getElementById('published').checked=true;d.getElementById('profile-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await wait();assert.ok(saved);assert.equal(saved.published,true);assert.equal(saved.tradeIds[0],'transport');assert.equal(saved.zones[0],'Kolwezi');
 }finally{dom.window.close();}
});
test('targeted quote survives page parameters and sends vendor plus trade',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(web,'operations.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost/operations.html?partner=vendor-id&trade=transport'});let sent;
 try{dom.window.apiCall=async(url,opts={})=>{
 if(url==='/auth/me')return {user:{role:'customer'}};if(url==='/partners/vendor-id')return {partner:{...partner,id:'vendor-id'}};
 if(url==='/btp/quotes'&&opts.method==='POST'){sent=opts.body;return {};}
 if(url==='/btp/quotes')return {quotes:[]};if(url==='/btp/missions')return {missions:[]};throw Error(url);
 };dom.window.eval(fs.readFileSync(path.join(web,'operations.js'),'utf8'));await wait();const d=dom.window.document;assert.equal(d.getElementById('request-target').hidden,false);assert.equal(d.querySelector('#request-target img'),null);
 d.getElementById('request-text').value='Transport de 100 blocs';d.getElementById('request-destination').value='Kolwezi';d.getElementById('request-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));await wait();assert.equal(sent.targetVendorId,'vendor-id');assert.equal(sent.requestedTradeId,'transport');assert.equal(sent.customerId,undefined);
 }finally{dom.window.close();}
});
