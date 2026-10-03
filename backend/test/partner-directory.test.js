const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),express=require('express');
const {PGlite}=require('@electric-sql/pglite');
const {installPartnerDirectory,TRADES}=require('../partnerDirectory');
const {installBtpOperations}=require('../btpOperations');
test('partner directory: opt-in, filters, owner access and targeted quote routing',{timeout:120000},async()=>{
 const pg=new PGlite();let server;
 try{
 const schema=fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;','');await pg.exec(schema);await pg.exec(schema);
 const query=async(sql,params=[])=>{const r=await pg.query(sql,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};};const database={query,connect:async()=>({query,release(){}})};const actors={};
 for(const role of ['customer','other','vendor','vendor2','admin']){
  const customerId=(await query('INSERT INTO customer(full_name) VALUES($1) RETURNING id',[role])).rows[0].id;
  const actualRole=role==='other'?'customer':role.startsWith('vendor')?'vendor':role;
  const userId=(await query('INSERT INTO user_account(email,password_hash,customer_id,role) VALUES($1,$2,$3,$4) RETURNING id',[role+'@example.test','unused',customerId,actualRole])).rows[0].id;
  actors[role]={role:actualRole,customerId,userId};if(actualRole==='vendor')actors[role].vendorId=(await query("INSERT INTO vendor(user_id,business_name,category,phone) VALUES($1,$2,'services','PRIVATE PHONE') RETURNING id",[userId,role])).rows[0].id;
 }
 const app=express();app.use(express.json());const deps={database,requireAuthentication:(req,res,next)=>{const a=actors[req.get('X-Test-Actor')];if(!a)return res.status(401).json({});req.auth=a;next();},requireRole:(...roles)=>(req,res,next)=>roles.includes(req.auth.role)?next():res.status(403).json({})};installPartnerDirectory(app,deps);installBtpOperations(app,deps);app.use((e,req,res,next)=>res.status(500).json({message:e.message}));
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const check=async(actor,url,method='GET',body,status=200)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api`+url,{method,headers:{'Content-Type':'application/json','X-Test-Actor':actor},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
 const trade=TRADES.find(t=>t.label==='Maçonnerie').id;
 const profile={tradeIds:[trade,'transport'],specialties:['Blocs et fondations'],zones:['Kolwezi','Lualaba'],description:'Entreprise de maçonnerie et transport de matériaux.',references:'Maison réalisée à Kolwezi',rateNotes:'Prix sur visite et devis validé',availability:'available',published:false};
 assert.equal((await check('','/partners')).partners.length,0);
 await check('customer','/vendor/profile','PUT',profile,403);await check('','/vendor/profile','PUT',profile,401);
 await check('vendor','/vendor/profile','PUT',{...profile,vendorId:actors.vendor2.vendorId},400);
 await check('vendor','/vendor/profile','PUT',{...profile,tradeIds:['unknown']},400);
 await check('vendor','/vendor/profile','PUT',profile);assert.equal((await check('','/partners')).partners.length,0);
 await check('customer','/btp/quotes','POST',{request:'Besoin de blocs',destination:'Kolwezi',targetVendorId:actors.vendor.vendorId},404);
 await check('vendor','/vendor/profile','PUT',{...profile,published:true});
 const publicView=(await check('','/partners?trade='+trade+'&zone=kolw&q=fondations&availability=available')).partners;
 assert.equal(publicView.length,1);assert.equal(publicView[0].phone,undefined);assert.equal(publicView[0].user_id,undefined);assert.equal(publicView[0].email,undefined);
 assert.equal((await check('','/partners?q=%25')).partners.length,0);assert.equal((await check('','/partners?zone=Lubumbashi')).partners.length,0);
 await check('','/partners?trade=invalid','GET',undefined,400);
 assert.equal((await check('vendor2','/vendor/profile')).profile,null);
 const detail=(await check('','/partners/'+actors.vendor.vendorId)).partner;assert.equal(detail.references_text,profile.references);
 await check('customer','/btp/quotes','POST',{request:'Besoin de blocs',destination:'Kolwezi',targetVendorId:actors.vendor.vendorId,requestedTradeId:'soudure'},400);
 const q=(await check('customer','/btp/quotes','POST',{request:'Construire les fondations',destination:'Kolwezi centre',targetVendorId:actors.vendor.vendorId,requestedTradeId:trade},201)).quote;
 assert.equal(q.target_vendor_id,actors.vendor.vendorId);assert.equal(q.customer_id,actors.customer.customerId);
 const own=(await check('vendor','/vendor/quote-requests')).requests;assert.equal(own.length,1);assert.equal(own[0].id,q.id);assert.equal(own[0].customer_id,undefined);
 assert.equal((await check('vendor2','/vendor/quote-requests')).requests.length,0);
 await check('vendor','/btp/quotes/'+q.id,'GET',undefined,403);await check('other','/btp/quotes/'+q.id,'GET',undefined,404);
 assert.equal((await check('admin','/btp/quotes/'+q.id)).quote.target_vendor_name,'vendor');
 await check('vendor','/vendor/profile','PUT',{...profile,published:false});await check('','/partners/'+actors.vendor.vendorId,'GET',undefined,404);
 await check('vendor','/vendor/profile','PUT',{...profile,published:true});await query('UPDATE vendor SET is_active=false WHERE id=$1',[actors.vendor.vendorId]);
 assert.equal((await check('','/partners')).partners.length,0);await check('vendor','/vendor/profile','PUT',profile,403);assert.equal((await check('vendor','/vendor/quote-requests')).requests.length,0);
 await check('customer','/btp/quotes','POST',{request:'Demande impossible',destination:'Kolwezi',targetVendorId:actors.vendor.vendorId},404);
 }finally{if(server)await new Promise(r=>server.close(r));await pg.close();}
});
