const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {JSDOM}=require('jsdom');const {PGlite}=require('@electric-sql/pglite');const {CONSTRUCTION_CATALOG:c}=require('../constructionCatalog');const {seedCatalog}=require('../catalogStore');
test('expanded catalogue has stable unique identifiers and quote-only unconfirmed references',()=>{
 assert.equal(new Set(c.map(x=>x.id)).size,c.length);
 for(const x of c){assert.ok(x.name_fr&&x.name_en&&x.unit&&x.catalog_group);assert.equal(x.price,0);assert.equal(x.stock,0);}
 for(const name of ['Brique','Climatiseurs split','Étude de structure béton armé','Installation de traitement d’eau','Levage et grutage','Maintenance de systèmes solaires','Ascenseurs','Fibre optique','Producteur de briques','Recherche de fournisseurs'])assert.ok(c.some(x=>x.name_fr.includes(name)),name);
 assert.equal(c.find(x=>x.id==='PRD-0001').name_fr,'Sable de rivière');assert.equal(c.find(x=>x.id==='SVC-0074').name_fr,'Architecture');
});
test('offline frontend exposes the full shared catalogue and defaults to all offers',async()=>{
 const root=path.join(__dirname,'../../web');const dom=new JSDOM('<html></html>',{runScripts:'outside-only',url:'http://localhost'});try{
 dom.window.console={log(){},warn(){}};dom.window.apiCall=async()=>{throw Error('Offline')};
 for(const file of ['launch-catalog.js','construction-catalog.js','products.js'])dom.window.eval(fs.readFileSync(path.join(root,file),'utf8'));
 await dom.window.loadProducts();assert.equal(dom.window.PRODUCTS.filter(x=>x.id==='PRD-0001').length,1);for(const x of c)assert.ok(dom.window.PRODUCTS.some(p=>p.id===x.id),x.id);
 const index=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'));assert.equal(index.window.document.getElementById('launch-only').checked,false);index.window.close();
 }finally{dom.window.close();}
});
test('catalogue sync adds references and preserves confirmed database prices and stock',{timeout:120000},async()=>{
 const pg=new PGlite();try{
 await pg.exec(fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
 await pg.query("INSERT INTO product(id,name_fr,name_en,unit,price_usd,stock_qty) VALUES('PRD-0001','Sable','Sand','m³',24.5,120)");
 await seedCatalog(pg,c);await seedCatalog(pg,c);
 const row=(await pg.query("SELECT price_usd,stock_qty FROM product WHERE id='PRD-0001'")).rows[0];assert.equal(Number(row.price_usd),24.5);assert.equal(Number(row.stock_qty),120);assert.equal(Number((await pg.query('SELECT COUNT(*) AS n FROM product')).rows[0].n),c.length);
 const newItem=(await pg.query("SELECT price_usd,stock_qty FROM product WHERE name_fr='Climatiseurs split'")).rows[0];assert.equal(Number(newItem.price_usd),0);assert.equal(Number(newItem.stock_qty),0);
 }finally{await pg.close();}
});
