'use strict';
const { z } = require('zod');
const { calculateQuote, precision } = require('./btpMoney');
const { offers } = require('../web/launch-catalog');
const uuid = z.string().uuid();
const text = z.string().trim().min(2).max(2000);
const amount = z.number().min(0).max(1000000).refine(v => precision(v, 2));
const lineSchema = z.object({ description: text, unit: z.string().trim().min(1).max(30), quantity: z.number().positive().max(100000).refine(v => precision(v, 3)), basePriceUsd: amount, productId: z.string().trim().min(1).max(80).optional(), vendorId: uuid.optional() }).strict();
const revisionSchema = z.object({ expectedRevision: z.number().int().min(0), lines: z.array(lineSchema).min(1).max(100), commissionPercent: z.number().min(0).max(100).refine(v => precision(v, 2)), transportUsd: amount, terms: text, validUntil: z.string().datetime({ offset: true }), publish: z.boolean(), availabilityConfirmed: z.literal(true) }).strict();
class OperationError extends Error { constructor(status, message) { super(message); this.status = status; } }
function fail(status, message) { throw new OperationError(status, message); }
function parse(schema, input) { const value = schema.safeParse(input); if (!value.success) fail(400, 'Données invalides'); return value.data; }
function installBtpOperations(app, { database, requireAuthentication, requireRole }) {
  const wrap = handler => async (req, res, next) => { try { if (!database) fail(503, 'Base de données indisponible'); await handler(req, res); } catch (error) { if (error.status) return res.status(error.status).json({ success: false, message: error.message }); if (error.code === '23505') return res.status(409).json({ success: false, message: 'Référence ou opération déjà enregistrée' }); next(error); } };
  const transaction = async callback => {
    const client = await database.connect();
    try { await client.query('BEGIN'); const result = await callback(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  };
  const event = (c, type, id, req, action, details = {}) => c.query('INSERT INTO btp_operation_event(entity_type,entity_id,actor_id,action,details) VALUES($1,$2,$3,$4,$5::jsonb)', [type, id, req.auth.userId, action, JSON.stringify(details)]);
  const queryOne = async (c, sql, args, label) => { const row = (await c.query(sql, args)).rows[0]; if (!row) fail(404, `${label} introuvable`); return row; };
  const activeVendor = async (c, id) => queryOne(c, 'SELECT id FROM vendor WHERE id=$1 AND is_active=true', [id], 'Partenaire actif');
  const scope = (req, type) => {
    if (req.auth.role === 'admin') return { sql: 'true', values: [] };
    if (type === 'quote' && req.auth.role === 'customer' && req.auth.customerId) return { sql: 'q.customer_id=$1', values: [req.auth.customerId] };
    if (type === 'mission' && req.auth.role === 'customer' && req.auth.customerId) return { sql: 'o.customer_id=$1', values: [req.auth.customerId] };
    if (type === 'mission' && req.auth.role === 'staff') return { sql: 'm.driver_user_id=$1', values: [req.auth.userId] };
    if (type === 'mission' && req.auth.role === 'vendor' && req.auth.vendorId) return { sql: 'm.carrier_vendor_id=$1', values: [req.auth.vendorId] };
    if (type === 'settlement' && req.auth.role === 'vendor' && req.auth.vendorId) return { sql: 's.vendor_id=$1', values: [req.auth.vendorId] };
    fail(403, 'Droits insuffisants');
  };
  const publicRevision = row => row && ({ revision: row.revision, lines: row.lines.map(({ description, unit, quantity }) => ({ description, unit, quantity })), transport_usd: row.transport_usd, total_usd: row.total_usd, terms: row.terms, valid_until: row.valid_until });

  app.get('/api/btp/directory', requireAuthentication, requireRole('admin'), wrap(async(req,res)=>{
    const customers=(await database.query("SELECT customer.id,COALESCE(customer.full_name,user_account.email) AS label FROM customer JOIN user_account ON user_account.customer_id=customer.id WHERE user_account.role='customer' AND user_account.is_active=true ORDER BY label LIMIT 500")).rows;
    const drivers=(await database.query("SELECT id,email AS label FROM user_account WHERE role='staff' AND is_active=true ORDER BY email LIMIT 500")).rows;
    const vendors=(await database.query('SELECT id,business_name AS label FROM vendor WHERE is_active=true ORDER BY business_name LIMIT 500')).rows;
    res.json({success:true,customers,drivers,vendors});
  }));

  app.get('/api/btp/quotes', requireAuthentication, wrap(async (req, res) => {
    const f = scope(req, 'quote');
    const result = await database.query(`SELECT q.*,r.total_usd,r.valid_until FROM btp_quote q LEFT JOIN btp_quote_revision r ON r.quote_id=q.id AND r.revision=q.revision WHERE ${f.sql} ORDER BY q.created_at DESC LIMIT 200`, f.values);
    res.json({ success: true, quotes: req.auth.role==='admin' ? result.rows : result.rows.map(q => ['sent','accepted','rejected'].includes(q.status) ? q : {...q,total_usd:null,valid_until:null}) });
  }));
  app.post('/api/btp/quotes', requireAuthentication, requireRole('admin', 'customer'), wrap(async (req, res) => {
    const b = parse(z.object({ customerId: uuid.optional(), request: text, destination: text }).strict(), req.body);
    const customerId = req.auth.role === 'customer' ? req.auth.customerId : b.customerId;
    if (!customerId) fail(400, 'Client requis');
    const quote = await transaction(async c => {
      await queryOne(c, 'SELECT id FROM customer WHERE id=$1', [customerId], 'Client');
      const q = (await c.query('INSERT INTO btp_quote(customer_id,request,destination,created_by) VALUES($1,$2,$3,$4) RETURNING *', [customerId,b.request,b.destination,req.auth.userId])).rows[0];
      await event(c,'quote',q.id,req,'requested'); return q;
    }); res.status(201).json({ success: true, quote });
  }));
  app.get('/api/btp/quotes/:id', requireAuthentication, wrap(async (req, res) => {
    const id = parse(uuid,req.params.id), f = scope(req,'quote');
    const q = await queryOne(database,`SELECT q.* FROM btp_quote q WHERE ${f.sql} AND q.id=$${f.values.length+1}`,[...f.values,id],'Devis');
    const revisions = (await database.query('SELECT * FROM btp_quote_revision WHERE quote_id=$1 ORDER BY revision',[id])).rows;
    res.json({ success:true, quote:q, revisions:req.auth.role === 'admin' ? revisions : (['sent','accepted','rejected'].includes(q.status) ? revisions.filter(r=>r.revision===q.revision).map(publicRevision) : []) });
  }));
  app.post('/api/btp/quotes/:id/revisions', requireAuthentication, requireRole('admin'), wrap(async (req,res) => {
    const id=parse(uuid,req.params.id), b=parse(revisionSchema,req.body);
    if (Date.parse(b.validUntil)<=Date.now()) fail(400,'Validité future requise');
    let totals; try { totals=calculateQuote(b.lines,b.commissionPercent,b.transportUsd); } catch(e) { fail(400,e.message); }
    if (b.publish && totals.totalUsd<=0) fail(400,'Montant positif requis pour envoyer le devis');
    const quote=await transaction(async c => {
      const q=await queryOne(c,'SELECT * FROM btp_quote WHERE id=$1 FOR UPDATE',[id],'Devis');
      if (!['requested','draft','sent'].includes(q.status) || q.revision!==b.expectedRevision) fail(409,'Devis modifié ou verrouillé');
      const quantities=new Map();
      for(const line of b.lines) {
        if(line.vendorId) await activeVendor(c,line.vendorId);
        if(line.productId) {
          const p=await queryOne(c,'SELECT id,vendor_id FROM product WHERE id=$1 AND is_active=true',[line.productId],'Produit actif');
          if(p.vendor_id && p.vendor_id!==line.vendorId) fail(400,'Fournisseur incohérent avec le produit');
          quantities.set(line.productId,(quantities.get(line.productId)||0)+line.quantity);
        }
      }
      for(const [productId,qty] of quantities){const offer=offers.find(x=>x.id===productId);if(offer && qty<offer.minimumQuantity) fail(400,`Minimum ${offer.minimumQuantity} pour ${offer.name_fr}`);}
      const rev=q.revision+1;
      await c.query('INSERT INTO btp_quote_revision(quote_id,revision,lines,subtotal_usd,commission_percent,commission_usd,transport_usd,total_usd,terms,valid_until,created_by) VALUES($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11)',[id,rev,JSON.stringify(b.lines),totals.subtotalUsd,b.commissionPercent,totals.commissionUsd,totals.transportUsd,totals.totalUsd,b.terms,b.validUntil,req.auth.userId]);
      const updated=(await c.query('UPDATE btp_quote SET revision=$2,status=$3,updated_at=now() WHERE id=$1 RETURNING *',[id,rev,b.publish?'sent':'draft'])).rows[0];
      await event(c,'quote',id,req,b.publish?'sent':'draft',{revision:rev,totalUsd:totals.totalUsd});return updated;
    }); res.status(201).json({success:true,quote});
  }));
  app.post('/api/btp/quotes/:id/decision', requireAuthentication, requireRole('customer'), wrap(async(req,res)=>{
    const id=parse(uuid,req.params.id), b=parse(z.object({expectedRevision:z.number().int().positive(),decision:z.enum(['accepted','rejected'])}).strict(),req.body);
    const quote=await transaction(async c=>{
      const q=await queryOne(c,'SELECT * FROM btp_quote WHERE id=$1 AND customer_id=$2 FOR UPDATE',[id,req.auth.customerId],'Devis');
      if(q.status!=='sent'||q.revision!==b.expectedRevision) fail(409,'Version du devis modifiée ou décision déjà prise');
      const revision=await queryOne(c,'SELECT valid_until FROM btp_quote_revision WHERE quote_id=$1 AND revision=$2',[id,q.revision],'Version');
      if(b.decision==='accepted'&&new Date(revision.valid_until).getTime()<=Date.now()) fail(409,'Devis expiré');
      const updated=(await c.query('UPDATE btp_quote SET status=$2,updated_at=now() WHERE id=$1 RETURNING *',[id,b.decision])).rows[0];
      await event(c,'quote',id,req,b.decision,{revision:q.revision});return updated;
    });res.json({success:true,quote});
  }));
  app.post('/api/btp/quotes/:id/cancel', requireAuthentication, requireRole('admin'), wrap(async(req,res)=>{
    const id=parse(uuid,req.params.id);
    const quote=await transaction(async c=>{
      const q=await queryOne(c,'SELECT * FROM btp_quote WHERE id=$1 FOR UPDATE',[id],'Devis');
      if(q.order_id || ['rejected','cancelled'].includes(q.status)) fail(409,'Annulez la commande liée ou choisissez un devis actif');
      const updated=(await c.query("UPDATE btp_quote SET status='cancelled',updated_at=now() WHERE id=$1 RETURNING *",[id])).rows[0];
      await event(c,'quote',id,req,'cancelled');return updated;
    });res.json({success:true,quote});
  }));

  // Create a pending order from the accepted immutable quote, exactly once. Quote
  // orders are paid through existing providers; stock is reserved atomically here.
  app.post('/api/btp/quotes/:id/order',requireAuthentication,requireRole('admin'),wrap(async(req,res)=>{
    const id=parse(uuid,req.params.id);
    const b=parse(z.object({paymentProvider:z.enum(['paypal','cinetpay','airtel_money','orange_money'])}).strict(),req.body);
    const order=await transaction(async c=>{
      const q=await queryOne(c,'SELECT * FROM btp_quote WHERE id=$1 FOR UPDATE',[id],'Devis');
      if(q.order_id) return queryOne(c,'SELECT * FROM orders WHERE id=$1',[q.order_id],'Commande');
      if(q.status!=='accepted') fail(409,'Acceptation client requise');
      const rev=await queryOne(c,'SELECT * FROM btp_quote_revision WHERE quote_id=$1 AND revision=$2',[id,q.revision],'Version');
      const quantities=new Map();for(const l of rev.lines) if(l.productId) quantities.set(l.productId,(quantities.get(l.productId)||0)+l.quantity);
      for(const [productId,qty] of [...quantities].sort(([a],[b])=>a.localeCompare(b))){
        const p=await queryOne(c,'SELECT id,stock_qty,vendor_id FROM product WHERE id=$1 AND is_active=true FOR UPDATE',[productId],'Produit actif');
        if(p.vendor_id) await activeVendor(c,p.vendor_id);
        if(Number(p.stock_qty)<qty || p.stock_qty===null) fail(409,`Stock insuffisant pour ${productId}`);
        await c.query('UPDATE product SET stock_qty=stock_qty-$2 WHERE id=$1',[productId,qty]);
      }
      const o=(await c.query("INSERT INTO orders(customer_id,currency,subtotal_amount,delivery_amount,total_amount) VALUES($1,'USD',$2,$3,$4) RETURNING *",[q.customer_id,Number(rev.subtotal_usd)+Number(rev.commission_usd),rev.transport_usd,rev.total_usd])).rows[0];
      let remainingCommission = Math.round(Number(rev.commission_usd)*100);
      for(const [index,l] of rev.lines.entries()) {
        if(l.vendorId) await activeVendor(c,l.vendorId);
        // Supplier amounts remain immutable in the quote; order line prices include markup.
        const baseCents= Math.round(calculateQuote([l],0,0).subtotalUsd*100);
        const allocated=index===rev.lines.length-1 ? remainingCommission : Math.min(remainingCommission,Math.round(baseCents*Number(rev.commission_percent)/100));
        remainingCommission-=allocated;
        const lineTotal=(baseCents+allocated)/100;
        const unitPrice=Math.round(lineTotal/l.quantity*100)/100;
        await c.query('INSERT INTO order_item(order_id,product_id,qty,unit_price_usd,vendor_id,quote_description,quote_unit,line_total_usd) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[o.id,l.productId||null,l.quantity,unitPrice,l.vendorId||null,l.description,l.unit,lineTotal]);
      }
      await c.query('INSERT INTO payment(order_id,provider,amount,currency) VALUES($1,$2,$3,$4)',[o.id,b.paymentProvider,o.total_amount,'USD']);
      await c.query('UPDATE btp_quote SET order_id=$2,updated_at=now() WHERE id=$1',[id,o.id]);await event(c,'quote',id,req,'order_created',{orderId:o.id});return o;
    });res.json({success:true,order});
  }));
  // Only owned platform products may have their physical stock confirmed here.
  app.patch('/api/btp/stock/:id',requireAuthentication,requireRole('admin'),wrap(async(req,res)=>{
    const b=parse(z.object({stock:z.number().min(0).max(1000000).refine(v=>precision(v,3))}).strict(),req.body);
    const result=await database.query('UPDATE product SET stock_qty=$2 WHERE id=$1 AND vendor_id IS NULL RETURNING id,stock_qty',[req.params.id,b.stock]);
    if(!result.rowCount) fail(404,'Produit plateforme introuvable');res.json({success:true,product:result.rows[0]});
  }));

  app.get('/api/btp/missions',requireAuthentication,wrap(async(req,res)=>{
    const f=scope(req,'mission');const result=await database.query(`SELECT m.* FROM btp_mission m JOIN orders o ON o.id=m.order_id WHERE ${f.sql} ORDER BY m.created_at DESC LIMIT 200`,f.values);res.json({success:true,missions:result.rows});
  }));
  app.post('/api/btp/missions',requireAuthentication,requireRole('admin'),wrap(async(req,res)=>{
    const b=parse(z.object({orderId:uuid,carrierVendorId:uuid,driverUserId:uuid.optional(),vehicle:text,origin:text,destination:text,loadDescription:text,plannedAt:z.string().datetime({offset:true})}).strict(),req.body);
    const mission=await transaction(async c=>{
      const o=await queryOne(c,'SELECT * FROM orders WHERE id=$1 FOR UPDATE',[b.orderId],'Commande');
      if(!['confirmed','delivering'].includes(o.status)) fail(409,'Commande confirmée requise');
      await activeVendor(c,b.carrierVendorId);
      if(b.driverUserId) await queryOne(c,"SELECT id FROM user_account WHERE id=$1 AND is_active=true AND role='staff'",[b.driverUserId],'Chauffeur staff actif');
      const m=(await c.query('INSERT INTO btp_mission(order_id,carrier_vendor_id,driver_user_id,vehicle,origin,destination,load_description,planned_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[b.orderId,b.carrierVendorId,b.driverUserId||null,b.vehicle,b.origin,b.destination,b.loadDescription,b.plannedAt,req.auth.userId])).rows[0];await event(c,'mission',m.id,req,'assigned');return m;
    });res.status(201).json({success:true,mission});
  }));
  app.patch('/api/btp/missions/:id/status',requireAuthentication,requireRole('admin','staff','vendor'),wrap(async(req,res)=>{
    const id=parse(uuid,req.params.id),b=parse(z.object({status:z.enum(['in_transit','delivered','completed','cancelled']),proof:text.optional()}).strict(),req.body);
    const mission=await transaction(async c=>{
      const f=scope(req,'mission');const m=await queryOne(c,`SELECT m.* FROM btp_mission m JOIN orders o ON o.id=m.order_id WHERE ${f.sql} AND m.id=$${f.values.length+1} FOR UPDATE OF m`,[...f.values,id],'Mission');
      const transitions={assigned:['in_transit','cancelled'],in_transit:['delivered','cancelled'],delivered:['completed'],completed:[],cancelled:[]};
      if(!transitions[m.status].includes(b.status)) fail(409,'Transition de mission interdite');
      if(['completed','cancelled'].includes(b.status)&&req.auth.role!=='admin') fail(403,'Validation administrateur requise');
      if(['delivered','completed'].includes(b.status)&&!b.proof) fail(400,'Référence de preuve de réception requise');
      const o=await queryOne(c,'SELECT status FROM orders WHERE id=$1 FOR UPDATE',[m.order_id],'Commande');
      if(o.status==='cancelled') fail(409,'Commande annulée');
      const updated=(await c.query('UPDATE btp_mission SET status=$2,delivery_proof=COALESCE($3,delivery_proof),updated_at=now() WHERE id=$1 RETURNING *',[id,b.status,b.proof||null])).rows[0];
      if(b.status==='in_transit') await c.query("UPDATE orders SET status='delivering',updated_at=now() WHERE id=$1 AND status='confirmed'",[m.order_id]);
      // Overall order completion remains controlled by existing order workflow:
      // several missions or service suppliers can participate in one order.
      await event(c,'mission',id,req,b.status,{proof:b.proof||null});return updated;
    });res.json({success:true,mission});
  }));

  app.get('/api/btp/settlements',requireAuthentication,wrap(async(req,res)=>{
    const f=scope(req,'settlement');const result=await database.query(`SELECT s.* FROM btp_settlement s WHERE ${f.sql} ORDER BY s.created_at DESC LIMIT 200`,f.values);res.json({success:true,settlements:result.rows});
  }));
  app.post('/api/btp/settlements',requireAuthentication,requireRole('admin'),wrap(async(req,res)=>{
    const b=parse(z.object({orderId:uuid,vendorId:uuid,purpose:text,amountUsd:amount.refine(v=>v>0)}).strict(),req.body);
    const settlement=await transaction(async c=>{
      const o=await queryOne(c,'SELECT status,currency,total_amount FROM orders WHERE id=$1 FOR UPDATE',[b.orderId],'Commande');
      if(o.currency!=='USD') fail(400,'Règlements USD uniquement : conversion à confirmer séparément');
      if(o.status!=='completed') fail(409,'Commande terminée requise pour un règlement');
      await activeVendor(c,b.vendorId);
      const associated=await c.query('SELECT 1 FROM order_item WHERE order_id=$1 AND vendor_id=$2 UNION SELECT 1 FROM btp_mission WHERE order_id=$1 AND carrier_vendor_id=$2 AND status=\'completed\'',[b.orderId,b.vendorId]);
      if(!associated.rowCount) fail(400,'Partenaire sans prestation sur cette commande');
      const committed=await c.query("SELECT COALESCE(SUM(amount_usd),0) AS amount FROM btp_settlement WHERE order_id=$1 AND status <> 'cancelled'",[b.orderId]);
      if(Number(committed.rows[0].amount)+b.amountUsd>Number(o.total_amount)) fail(409,'Règlements supérieurs au montant de la commande');
      const s=(await c.query('INSERT INTO btp_settlement(order_id,vendor_id,purpose,amount_usd,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *',[b.orderId,b.vendorId,b.purpose,b.amountUsd,req.auth.userId])).rows[0];await event(c,'settlement',s.id,req,'due',{amountUsd:b.amountUsd});return s;
    });res.status(201).json({success:true,settlement});
  }));
  app.patch('/api/btp/settlements/:id/status',requireAuthentication,requireRole('admin'),wrap(async(req,res)=>{
    const id=parse(uuid,req.params.id),b=parse(z.object({status:z.enum(['paid','cancelled']),paymentReference:z.string().trim().min(6).max(120).optional()}).strict(),req.body);
    const settlement=await transaction(async c=>{
      const s=await queryOne(c,'SELECT * FROM btp_settlement WHERE id=$1 FOR UPDATE',[id],'Règlement');
      if(s.status==='paid'&&b.status==='paid'&&s.payment_reference===b.paymentReference) return s;
      if(s.status!=='due') fail(409,'Règlement déjà clôturé');
      if(b.status==='paid') {
        if(!b.paymentReference) fail(400,'Référence bancaire ou mobile money requise');
        const o=await queryOne(c,"SELECT status FROM orders WHERE id=$1 FOR UPDATE",[s.order_id],'Commande');if(o.status!=='completed')fail(409,'Commande non terminée');
        const paid=await c.query("SELECT COALESCE(SUM(amount),0) AS amount FROM payment WHERE order_id=$1 AND status='paid' AND currency='USD'",[s.order_id]);
        const total=await queryOne(c,'SELECT total_amount FROM orders WHERE id=$1',[s.order_id],'Commande');
        if(Number(paid.rows[0].amount)<Number(total.total_amount))fail(409,'Paiement client intégral confirmé requis');
      }
      const updated=(await c.query("UPDATE btp_settlement SET status=$2,payment_reference=$3,paid_at=CASE WHEN $2='paid' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 RETURNING *",[id,b.status,b.status==='paid'?b.paymentReference:null])).rows[0];await event(c,'settlement',id,req,b.status,{reference:b.paymentReference||null});return updated;
    });res.json({success:true,settlement});
  }));
  app.get('/api/btp/events/:type/:id',requireAuthentication,requireRole('admin'),wrap(async(req,res)=>{
    const type=parse(z.enum(['quote','mission','settlement']),req.params.type),id=parse(uuid,req.params.id);
    const events=(await database.query('SELECT * FROM btp_operation_event WHERE entity_type=$1 AND entity_id=$2 ORDER BY id',[type,id])).rows;res.json({success:true,events});
  }));
}
module.exports={installBtpOperations};
