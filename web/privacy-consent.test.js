'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm'), assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'privacy-consent.js'),'utf8');

function env(stored=null){
  const store=new Map(); if(stored!==null) store.set('monchantier_privacy_v1',stored);
  const appended=[], listeners={};
  const banner={hidden:false,setAttribute(){},addEventListener(){}};
  const accept={addEventListener:(e,f)=>listeners.accept=f};
  const reject={addEventListener:(e,f)=>listeners.reject=f};
  const body={appendChild(el){appended.push(el);}};
  const head={appendChild(el){appended.push(el); if(el.onload) el.onload();}};
  const document={
    body,head,
    getElementById(id){return id==='privacy-choice'?banner:id==='privacy-accept-ads'?accept:id==='privacy-reject'?reject:null;},
    createElement(){return {style:{},dataset:{},setAttribute(){},addEventListener(e,f){this['on'+e]=f;}};},
    querySelector(sel){return appended.find(x=>sel==='script[data-monchantier-google-ads]'&&x.dataset?.monchantierGoogleAds)||null;}
  };
  const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  const location={reloadCalled:false,reload(){this.reloadCalled=true;}};
  const window={dataLayer:[],location};
  const ctx={window,document,localStorage,location,Date,JSON,Boolean}; window.window=window;
  vm.runInNewContext(source,ctx);
  return {store,appended,listeners,window,banner};
}
const ads=xs=>xs.filter(x=>String(x.src||'').includes('googletagmanager.com/gtag/js'));
{
 const e=env(); assert.equal(ads(e.appended).length,0,'Google Ads loaded before a choice');
}
{
 const e=env(JSON.stringify({ads:false,version:1,updatedAt:'2026-10-10T00:00:00Z'}));
 assert.equal(ads(e.appended).length,0,'Google Ads loaded after refusal');
}
{
 const e=env(); e.listeners.accept(); assert.equal(ads(e.appended).length,1,'Accept must load Google Ads exactly once');
 assert.equal(JSON.parse(e.store.get('monchantier_privacy_v1')).ads,true);
}
{
 const e=env(JSON.stringify({ads:true,version:1,updatedAt:'2026-10-10T00:00:00Z'}));
 assert.equal(ads(e.appended).length,1,'Prior acceptance should load Google Ads');
 e.listeners.reject(); assert.equal(JSON.parse(e.store.get('monchantier_privacy_v1')).ads,false); assert.equal(e.window.location.reloadCalled,true,'Withdrawal must reload after ads were loaded');
}
console.log('privacy-consent tests: OK');
