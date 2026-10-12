const { z } = require('zod');

function installAdminCatalog(app, { database, requireAuthentication, requireRole }) {
  const auth = [requireAuthentication, requireRole('admin')];
  const category = z.enum(['produits','services','facilitation','partenaires']);
  const httpsUrl = z.string().trim().max(1000).regex(/^https:\/\//i, 'URL HTTPS requise');
  const spec = z.object({ label:z.string().trim().min(1).max(120), value:z.string().trim().min(1).max(500), position:z.number().int().min(0).max(999).optional() });
  const image = z.object({ url:httpsUrl, alt:z.string().trim().max(200).optional(), position:z.number().int().min(0).max(99).optional() });
  const create = z.object({
    id:z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/),
    nameFr:z.string().trim().min(2).max(120), nameEn:z.string().trim().min(2).max(120),
    unit:z.string().trim().min(1).max(20), price:z.number().min(0).max(1000000),
    category, catalogGroup:z.string().trim().max(80).optional(), stockQty:z.number().min(0).max(1000000).optional(),
    images:z.array(image).max(12).default([]), specs:z.array(spec).max(60).default([])
  });
  const update = create.omit({id:true}).partial();

  function dbReady(res){ if(!database){res.status(503).json({success:false,message:'Base de données indisponible'});return false;} return true; }
  function bad(res, parsed){res.status(400).json({success:false,message:'Données produit invalides',errors:parsed.error.flatten().fieldErrors});}

  app.get('/api/admin/catalog', ...auth, async(req,res,next)=>{try{
    if(!dbReady(res))return;
    const products=(await database.query(`SELECT p.id,p.name_fr,p.name_en,p.unit,p.price_usd,p.category,p.catalog_group,p.stock_qty,p.image_url,p.is_active,p.vendor_id,
      COALESCE((SELECT json_agg(json_build_object('id',pi.id,'url',pi.url,'alt',pi.alt_text,'position',pi.position) ORDER BY pi.position,pi.id) FROM product_image pi WHERE pi.product_id=p.id),'[]'::json) images,
      COALESCE((SELECT json_agg(json_build_object('id',ps.id,'label',ps.label,'value',ps.value,'position',ps.position) ORDER BY ps.position,ps.id) FROM product_spec ps WHERE ps.product_id=p.id),'[]'::json) specs
      FROM product p ORDER BY p.is_active DESC,p.name_fr`)).rows;
    res.json({success:true,products});
  }catch(e){next(e)}});

  app.post('/api/admin/catalog', ...auth, async(req,res,next)=>{
    const p=create.safeParse(req.body); if(!p.success)return bad(res,p); if(!dbReady(res))return;
    const b=p.data, client=await database.connect();
    try{await client.query('BEGIN');
      await client.query(`INSERT INTO product(id,name_fr,name_en,unit,price_usd,category,catalog_group,stock_qty,image_url,is_active,pricing_status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,true,'platform')`,[b.id,b.nameFr,b.nameEn,b.unit,b.price,b.category,b.catalogGroup||null,b.stockQty??0,b.images[0]?.url||null]);
      for(const [i,x] of b.images.entries()) await client.query('INSERT INTO product_image(product_id,url,alt_text,position) VALUES($1,$2,$3,$4)',[b.id,x.url,x.alt||null,x.position??i]);
      for(const [i,x] of b.specs.entries()) await client.query('INSERT INTO product_spec(product_id,label,value,position) VALUES($1,$2,$3,$4)',[b.id,x.label,x.value,x.position??i]);
      await client.query('COMMIT'); res.status(201).json({success:true,id:b.id});
    }catch(e){await client.query('ROLLBACK'); if(e.code==='23505')return res.status(409).json({success:false,message:'Référence produit déjà utilisée'}); next(e)}finally{client.release()}
  });

  app.patch('/api/admin/catalog/:id', ...auth, async(req,res,next)=>{
    const p=update.safeParse(req.body); if(!p.success)return bad(res,p); if(!dbReady(res))return;
    const b=p.data, sets=[], vals=[]; const add=(col,val)=>{vals.push(val);sets.push(`${col}=$${vals.length}`)};
    if(b.nameFr!==undefined)add('name_fr',b.nameFr); if(b.nameEn!==undefined)add('name_en',b.nameEn); if(b.unit!==undefined)add('unit',b.unit);
    if(b.price!==undefined)add('price_usd',b.price); if(b.category!==undefined)add('category',b.category); if(b.catalogGroup!==undefined)add('catalog_group',b.catalogGroup||null); if(b.stockQty!==undefined)add('stock_qty',b.stockQty);
    const client=await database.connect();
    try{await client.query('BEGIN');
      if(sets.length){vals.push(req.params.id);const r=await client.query(`UPDATE product SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING id`,vals);if(!r.rowCount){await client.query('ROLLBACK');return res.status(404).json({success:false,message:'Produit introuvable'})}}
      if(b.images!==undefined){await client.query('DELETE FROM product_image WHERE product_id=$1',[req.params.id]);for(const [i,x] of b.images.entries())await client.query('INSERT INTO product_image(product_id,url,alt_text,position) VALUES($1,$2,$3,$4)',[req.params.id,x.url,x.alt||null,x.position??i]);await client.query('UPDATE product SET image_url=$2 WHERE id=$1',[req.params.id,b.images[0]?.url||null])}
      if(b.specs!==undefined){await client.query('DELETE FROM product_spec WHERE product_id=$1',[req.params.id]);for(const [i,x] of b.specs.entries())await client.query('INSERT INTO product_spec(product_id,label,value,position) VALUES($1,$2,$3,$4)',[req.params.id,x.label,x.value,x.position??i])}
      await client.query('COMMIT');res.json({success:true,id:req.params.id});
    }catch(e){await client.query('ROLLBACK');next(e)}finally{client.release()}
  });

  // Archivage: on préserve les références des commandes/factures existantes.
  app.delete('/api/admin/catalog/:id', ...auth, async(req,res,next)=>{try{
    if(!dbReady(res))return; const r=await database.query('UPDATE product SET is_active=false WHERE id=$1 RETURNING id',[req.params.id]);
    if(!r.rowCount)return res.status(404).json({success:false,message:'Produit introuvable'});res.json({success:true,id:req.params.id,archived:true});
  }catch(e){next(e)}});
  app.post('/api/admin/catalog/:id/restore', ...auth, async(req,res,next)=>{try{
    if(!dbReady(res))return; const r=await database.query('UPDATE product SET is_active=true WHERE id=$1 RETURNING id',[req.params.id]);
    if(!r.rowCount)return res.status(404).json({success:false,message:'Produit introuvable'});res.json({success:true,id:req.params.id,isActive:true});
  }catch(e){next(e)}});
}
module.exports={installAdminCatalog};
