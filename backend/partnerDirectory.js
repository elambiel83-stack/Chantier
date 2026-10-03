'use strict';
const {z}=require('zod');
const {CONSTRUCTION_CATALOG}=require('./constructionCatalog');
const TRADES=[...CONSTRUCTION_CATALOG.filter(x=>x.catalog_group==='metiers').map(x=>({id:x.id,label:x.name_fr})),...[
 ['transport','Transport de matériaux'],['logistique','Logistique et manutention'],['terrassement','Terrassement et conduite d’engins'],['toiture','Charpente et couverture'],['soudure','Soudure et ferronnerie'],['etancheite','Étanchéité'],['solaire','Installation solaire'],['hse','Sécurité et HSE'],['qualite','Contrôle qualité et supervision'],['forage','Forage, pompage et exhaure'],['nettoyage','Nettoyage de chantier'],['production','Production de matériaux'],['grossiste','Commerce de matériaux'],['location','Location d’équipements']
].map(([id,label])=>({id,label}))];
const tradeIds=new Set(TRADES.map(x=>x.id));
const short=z.string().trim().min(2).max(120);
const profileSchema=z.object({tradeIds:z.array(z.string().refine(x=>tradeIds.has(x))).min(1).max(36).refine(x=>new Set(x).size===x.length),specialties:z.array(short).max(20),zones:z.array(short).min(1).max(20),description:z.string().trim().min(20).max(3000),references:z.string().trim().max(3000),rateNotes:z.string().trim().max(2000),availability:z.enum(['available','limited','unavailable']),published:z.boolean()}).strict();
function installPartnerDirectory(app,{database,requireAuthentication,requireRole}){
 const wrap=fn=>async(req,res,next)=>{try{if(!database)return res.status(503).json({message:'Base de données indisponible'});await fn(req,res);}catch(e){next(e);}};
 const publicColumns='v.id,v.business_name,v.category,p.trade_ids,p.specialties,p.zones,p.description,p.references_text,p.rate_notes,p.availability,p.updated_at';
 const visible="p.published=true AND v.is_active=true AND u.is_active=true AND u.role='vendor'";
 app.get('/api/trades',(req,res)=>res.json({success:true,trades:TRADES}));
 app.get('/api/partners',wrap(async(req,res)=>{
  const parsed=z.object({trade:z.string().refine(x=>tradeIds.has(x)).optional(),zone:z.string().trim().max(120).optional(),q:z.string().trim().max(120).optional(),availability:z.enum(['available','limited','unavailable']).optional(),page:z.coerce.number().int().min(1).max(10000).default(1)}).strict().safeParse(req.query);
  if(!parsed.success)return res.status(400).json({message:'Filtres invalides'});
  const b=parsed.data,args=[],clauses=[visible];const add=(sql,value)=>{args.push(value);clauses.push(sql.replaceAll('?',`$${args.length}`));};
  if(b.trade)add('?=ANY(p.trade_ids)',b.trade);
  // Literal substring searches: wildcard characters never broaden the result.
  if(b.zone)add('EXISTS(SELECT 1 FROM unnest(p.zones) AS zone WHERE strpos(lower(zone),lower(?))>0)',b.zone);
  if(b.q)add("strpos(lower(v.business_name||' '||p.description||' '||array_to_string(p.specialties,' ')),lower(?))>0",b.q);
  if(b.availability)add('p.availability=?',b.availability);
  args.push((b.page-1)*20);
  const rows=(await database.query(`SELECT ${publicColumns} FROM vendor v JOIN vendor_public_profile p ON p.vendor_id=v.id JOIN user_account u ON u.id=v.user_id WHERE ${clauses.join(' AND ')} ORDER BY v.business_name,v.id LIMIT 21 OFFSET $${args.length}`,args)).rows;
  res.json({success:true,partners:rows.slice(0,20),hasMore:rows.length>20,page:b.page});
 }));
 app.get('/api/partners/:id',wrap(async(req,res)=>{
  if(!z.string().uuid().safeParse(req.params.id).success)return res.status(400).json({message:'Identifiant invalide'});
  const rows=(await database.query(`SELECT ${publicColumns} FROM vendor v JOIN vendor_public_profile p ON p.vendor_id=v.id JOIN user_account u ON u.id=v.user_id WHERE ${visible} AND v.id=$1`,[req.params.id])).rows;
  if(!rows.length)return res.status(404).json({message:'Partenaire introuvable'});res.json({success:true,partner:rows[0]});
 }));
 app.get('/api/vendor/profile',requireAuthentication,requireRole('vendor'),wrap(async(req,res)=>{
  const v=(await database.query("SELECT v.id,v.business_name FROM vendor v JOIN user_account u ON u.id=v.user_id WHERE v.id=$1 AND v.is_active=true AND u.is_active=true AND u.role='vendor'",[req.auth.vendorId])).rows[0];
  if(!v)return res.status(403).json({message:'Profil partenaire actif requis'});
  const profile=(await database.query('SELECT * FROM vendor_public_profile WHERE vendor_id=$1',[v.id])).rows[0]||null;res.json({success:true,vendor:v,profile});
 }));
 app.put('/api/vendor/profile',requireAuthentication,requireRole('vendor'),wrap(async(req,res)=>{
  const parsed=profileSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Fiche invalide : choisissez des métiers, une zone et une présentation de 20 caractères minimum'});
  const b=parsed.data;
  const result=await database.query(`INSERT INTO vendor_public_profile(vendor_id,trade_ids,specialties,zones,description,references_text,rate_notes,availability,published)
  SELECT v.id,$2::text[],$3::text[],$4::text[],$5,$6,$7,$8,$9 FROM vendor v JOIN user_account u ON u.id=v.user_id WHERE v.id=$1 AND v.is_active=true AND u.is_active=true AND u.role='vendor'
  ON CONFLICT(vendor_id) DO UPDATE SET trade_ids=EXCLUDED.trade_ids,specialties=EXCLUDED.specialties,zones=EXCLUDED.zones,description=EXCLUDED.description,references_text=EXCLUDED.references_text,rate_notes=EXCLUDED.rate_notes,availability=EXCLUDED.availability,published=EXCLUDED.published,updated_at=now() RETURNING *`,[req.auth.vendorId,b.tradeIds,b.specialties,b.zones,b.description,b.references,b.rateNotes,b.availability,b.published]);
  if(!result.rows.length)return res.status(403).json({message:'Profil partenaire actif requis'});res.json({success:true,profile:result.rows[0]});
 }));
 app.get('/api/vendor/quote-requests',requireAuthentication,requireRole('vendor'),wrap(async(req,res)=>{
  const rows=(await database.query("SELECT q.id,q.request,q.destination,q.status,q.requested_trade_id,q.created_at FROM btp_quote q JOIN vendor v ON v.id=q.target_vendor_id WHERE v.id=$1 AND v.is_active=true ORDER BY q.created_at DESC LIMIT 200",[req.auth.vendorId])).rows;
  res.json({success:true,requests:rows});
 }));
}
module.exports={installPartnerDirectory,TRADES,tradeIds};
