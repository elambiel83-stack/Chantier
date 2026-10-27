(function () {
  const el=id=>document.getElementById(id);
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={requested:'Demande reçue',draft:'Brouillon',sent:'À accepter',accepted:'Accepté',rejected:'Refusé',assigned:'Attribuée',in_transit:'En route',delivered:'Livrée',completed:'Terminée',cancelled:'Annulé',due:'À régler',paid:'Réglé'};
  const money=v=>Number(v||0).toLocaleString('fr-FR',{style:'currency',currency:'USD'});
  const date=v=>v?new Date(v).toLocaleString('fr-FR'):'—';
  const options=(items,label='label')=>'<option value="">Choisir</option>'+items.map(x=>`<option value="${escape(x.id)}">${escape(x[label])}</option>`).join('');
  const api=(path,method='GET',body)=>window.apiCall('/btp'+path,{method,...(body===undefined?{}:{body})});
  const value=id=>el(id).value.trim();
  const queryParams=new URLSearchParams(location.search);
  let targetPartner=null;
  let role,selected,directory={vendors:[],customers:[],drivers:[]},products=[];
  const run=async callback=>{el('status').className='';el('status').textContent='Traitement…';try{await callback();el('status').textContent='Opération enregistrée.';}catch(e){el('status').className='ops-error';el('status').textContent=e.message||'Opération impossible';}};
  const button=(action,id,text,extra='')=>`<button type="button" data-action="${action}" data-id="${escape(id)}" ${extra}>${text}</button>`;
  async function refreshDirectory(){
    directory=await api('/directory');
    el('request-customer').innerHTML=options(directory.customers);
    el('mission-vendor').innerHTML=options(directory.vendors);el('settlement-vendor').innerHTML=options(directory.vendors);
    el('mission-driver').innerHTML='<option value="">Non attribué</option>'+directory.drivers.map(x=>`<option value="${escape(x.id)}">${escape(x.label)}</option>`).join('');
    const data=await window.apiCall('/orders');const orders=data.orders||[];
    const describe=o=>({id:o.id,label:`${o.full_name||'Client'} · ${o.id.slice(0,8)} · ${money(o.total_amount)}`});
    el('mission-order').innerHTML=options(orders.filter(x=>['confirmed','delivering'].includes(x.status)).map(describe));
    el('settlement-order').innerHTML=options(orders.filter(x=>x.status==='completed'&&x.currency==='USD').map(describe));
    products=(await window.apiCall('/products')).products||[];
    el('stock-product').innerHTML=options(products.filter(x=>!x.vendorName).map(x=>({id:x.id,label:x.name_fr})));
  }
  async function load(){
    const tasks=[];
    if(['admin','customer'].includes(role))tasks.push((async()=>{
      const {quotes}=await api('/quotes');el('quotes-list').innerHTML=quotes.map(q=>`<article class="ops-card"><strong>Devis ${escape(q.id.slice(0,8))} · ${escape(labels[q.status])}</strong><p>${escape(q.request)}</p><p>${escape(q.destination)} · ${money(q.total_usd)} · Version ${q.revision}</p>${button('quote',q.id,'Consulter')}</article>`).join('')||'<p>Aucun devis pour le moment.</p>';
    })());
    tasks.push((async()=>{
      const {missions}=await api('/missions');el('missions-list').innerHTML=missions.map(m=>{
        const allowed=role==='admin'||role==='staff'||role==='vendor';const next={assigned:'in_transit',in_transit:'delivered',delivered:'completed'}[m.status];
        return `<article class="ops-card"><strong>${escape(m.vehicle)} · ${escape(labels[m.status])}</strong><p>${escape(m.origin)} → ${escape(m.destination)}</p><p>${escape(m.load_description)} · ${date(m.planned_at)}</p>${m.delivery_proof?`<p>Réception : ${escape(m.delivery_proof)}</p>`:''}${allowed&&next&&(next!=='completed'||role==='admin')?`<label>Référence du bon / confirmation de réception<input id="proof-${escape(m.id)}" maxlength="2000"></label><div class="ops-actions">${button('mission',m.id,escape(labels[next]),`data-next="${next}"`)}</div>`:''}${role==='admin'&&['assigned','in_transit'].includes(m.status)?button('mission',m.id,'Annuler', 'data-next="cancelled"'):''}${role==='admin'?button('audit',m.id,'Historique','data-type="mission"'):''}</article>`;
      }).join('')||'<p>Aucune mission attribuée.</p>';
    })());
    if(['admin','vendor'].includes(role))tasks.push((async()=>{
      const {settlements}=await api('/settlements');el('settlements-list').innerHTML=settlements.map(s=>`<article class="ops-card"><strong>${escape(s.purpose)} · ${money(s.amount_usd)} · ${escape(labels[s.status])}</strong><p>Commande ${escape(s.order_id.slice(0,8))}</p>${s.payment_reference?`<p>Référence : ${escape(s.payment_reference)} · ${date(s.paid_at)}</p>`:''}${role==='admin'&&s.status==='due'?`<label>Référence du paiement réalisé<input id="reference-${escape(s.id)}" minlength="6" maxlength="120"></label><div class="ops-actions">${button('settlement',s.id,'Confirmer le paiement','data-next="paid"')}${button('settlement',s.id,'Annuler','data-next="cancelled"')}</div>`:''}${role==='admin'?button('audit',s.id,'Historique','data-type="settlement"'):''}</article>`).join('')||'<p>Aucun règlement.</p>';
    })());
    const results=await Promise.allSettled(tasks);for(const r of results)if(r.status==='rejected')throw r.reason;
  }
  function addLine(line={}){
    const div=document.createElement('div');div.className='quote-line';
    div.innerHTML=`<label>Description<input data-field="description" required maxlength="2000" value="${escape(line.description)}"></label><label>Unité<input data-field="unit" required maxlength="30" value="${escape(line.unit||'pcs')}"></label><label>Quantité<input data-field="quantity" type="number" min="0.001" max="100000" step="0.001" required value="${escape(line.quantity||1)}"></label><label>Prix fournisseur par unité (USD)<input data-field="basePriceUsd" type="number" min="0" max="1000000" step="0.01" required value="${escape(line.basePriceUsd||0)}"></label><label>Produit à réserver (facultatif)<select data-field="productId">${options(products.map(x=>({id:x.id,label:x.name_fr})))}</select></label><label>Fournisseur / prestataire (facultatif)<select data-field="vendorId">${options(directory.vendors)}</select></label><button type="button" data-remove-line>Retirer la ligne</button>`;
    div.querySelector('[data-field="productId"]').value=line.productId||'';div.querySelector('[data-field="vendorId"]').value=line.vendorId||'';el('quote-lines').append(div);
  }
  function documentNumber(prefix, quote, revision){
    const year=new Date(quote.created_at||Date.now()).getFullYear();
    return prefix+'-'+year+'-'+String(quote.id||'').replace(/-/g,'').slice(0,8).toUpperCase()+(revision?'-V'+revision:'');
  }
  function buildDocumentHtml(kind,autoPrint=true){
    if(!selected||!selected._printRevision)return '';
    const revision=selected._printRevision,isInvoice=kind==='invoice',title=isInvoice?'FACTURE':'DEVIS',number=documentNumber(isInvoice?'FAC':'DEV',selected,revision.revision);
    const lines=revision.lines.map(l=>{const unit=Number(l.basePriceUsd||0),qty=Number(l.quantity||0);return '<tr><td>'+escape(l.description)+'</td><td>'+escape(l.quantity)+' '+escape(l.unit)+'</td><td>'+money(unit)+'</td><td>'+money(qty*unit)+'</td></tr>';}).join('');
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+title+' '+number+'</title><style>@page{size:A4;margin:14mm}body{font:14px Arial,sans-serif;color:#17212b;margin:0}header{display:flex;justify-content:space-between;border-bottom:3px solid #c62828;padding-bottom:14px;margin-bottom:24px}.brand{font-size:25px;font-weight:800}.brand span{color:#c62828}.doc{text-align:right}h1{margin:0;font-size:28px}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:9px;border-bottom:1px solid #d7dce0;text-align:left}th{background:#f1f4f6}.totals{margin-left:auto;width:320px}.totals p{display:flex;justify-content:space-between}.grand{font-size:18px;font-weight:bold;border-top:2px solid #17212b;padding-top:8px}.terms{margin-top:28px;white-space:pre-wrap}.muted{color:#66717b;font-size:12px}.no-print{margin:0 0 18px}@media print{.no-print{display:none}}</style></head><body><button class="no-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button><header><div><div class="brand">CHANTIER<span>.online</span></div><div>Tout pour bâtir.</div></div><div class="doc"><h1>'+title+'</h1><strong>'+number+'</strong><div>Date : '+escape(date(new Date()))+'</div></div></header><p><strong>Objet :</strong> '+escape(selected.request)+'</p><p><strong>Destination :</strong> '+escape(selected.destination)+'</p><table><thead><tr><th>Désignation</th><th>Quantité</th><th>Prix unitaire</th><th>Montant</th></tr></thead><tbody>'+lines+'</tbody></table><div class="totals"><p><span>Sous-total</span><strong>'+money(revision.subtotal_usd)+'</strong></p><p><span>Commission ('+escape(revision.commission_percent)+' %)</span><strong>'+money(revision.commission_usd)+'</strong></p><p><span>Transport</span><strong>'+money(revision.transport_usd)+'</strong></p><p class="grand"><span>Total USD</span><span>'+money(revision.total_usd)+'</span></p></div>'+(!isInvoice?'<p><strong>Valable jusqu’au :</strong> '+escape(date(revision.valid_until))+'</p>':'')+'<div class="terms"><strong>Conditions :</strong><br>'+escape(revision.terms)+'</div><p class="muted">Document généré par Chantier.online.</p>'+(autoPrint?'<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),200));<\\/script>':'')+'</body></html>';
  }
  function printQuoteDocument(kind){
    if(!selected)return;
    const revision=selected._printRevision;if(!revision){el('status').className='ops-error';el('status').textContent='Aucune version chiffrée à imprimer.';return;}
    const isInvoice=kind==='invoice';
    if(isInvoice&&!selected.order_id){el('status').className='ops-error';el('status').textContent='La facture est disponible après conversion du devis accepté en commande.';return;}
    const html=buildDocumentHtml(kind,true);\n    const w=window.open('','_blank','noopener,noreferrer');if(!w){el('status').className='ops-error';el('status').textContent='Autorisez les fenêtres contextuelles pour imprimer.';return;}w.document.open();w.document.write(html);w.document.close();
  }
  async function sendDocument(kind,channel){
    if(!selected)return;
    const label=kind==='invoice'?'facture':'devis';
    if(!confirm('Envoyer '+label+' par '+(channel==='email'?'e-mail':'WhatsApp')+' ?'))return;
    const published=await api('/quotes/'+selected.id+'/document-link','POST',{kind,html:buildDocumentHtml(kind,false)});\n    const absoluteUrl=new URL(published.url,location.origin).href;\n    const result=await api('/quotes/'+selected.id+'/send-document','POST',{kind,channel,documentUrl:absoluteUrl});
    el('status').className='ops-success';el('status').textContent=(kind==='invoice'?'Facture':'Devis')+' '+result.number+' envoyé par '+(channel==='email'?'e-mail':'WhatsApp')+'.';
  }
  async function showQuote(id){
    const data=await api('/quotes/'+id);selected=data.quote;const rev=data.revisions.at(-1);selected._printRevision=rev;const detail=el('quote-detail');detail.hidden=false;
    detail.innerHTML=`<h3>Devis ${escape(id.slice(0,8))} · ${escape(labels[selected.status])}</h3><p>${escape(selected.request)}</p><p>Destination : ${escape(selected.destination)}</p>${selected.target_vendor_name?`<p>Partenaire demandé : ${escape(selected.target_vendor_name)}</p>`:''}${rev?`<p>Version ${rev.revision} · Valable jusqu’au ${date(rev.valid_until)}</p><ul>${rev.lines.map(l=>`<li>${escape(l.description)} : ${escape(l.quantity)} ${escape(l.unit)}</li>`).join('')}</ul><p>Conditions : ${escape(rev.terms)}</p><p>Transport : ${money(rev.transport_usd)} · <strong>Total : ${money(rev.total_usd)}</strong></p>`:'<p>Prix en préparation.</p>'}<div class="ops-actions">${rev?button('printQuote',id,'Imprimer / PDF du devis'):''}${role==='admin'&&rev?button('sendQuoteEmail',id,'Envoyer devis par e-mail'):''}${role==='admin'&&rev?button('sendQuoteWhatsapp',id,'Envoyer devis par WhatsApp'):''}${rev&&selected.order_id?button('printInvoice',id,'Imprimer / PDF de la facture'):''}${role==='admin'&&rev&&selected.order_id?button('sendInvoiceEmail',id,'Envoyer facture par e-mail'):''}${role==='admin'&&rev&&selected.order_id?button('sendInvoiceWhatsapp',id,'Envoyer facture par WhatsApp'):''}${role==='customer'&&selected.status==='sent'?`${button('decision',id,'Accepter cette version','data-decision="accepted"')}${button('decision',id,'Refuser','data-decision="rejected"')}`:''}${role==='admin'&&selected.status==='accepted'&&!selected.order_id?`<label>Paiement convenu<select id="quote-payment"><option value="airtel_money">Airtel Money</option><option value="orange_money">Orange Money</option><option value="paypal">PayPal</option><option value="cinetpay">CinetPay</option></select></label>${button('convert',id,'Créer la commande et réserver le stock')}`:''}${selected.order_id?'<a href="orders.html">Consulter la commande</a>':''}${role==='admin'&&!selected.order_id&&!['cancelled','rejected'].includes(selected.status)?button('cancelQuote',id,'Annuler le devis'):''}${role==='admin'?button('audit',id,'Historique','data-type="quote"'):''}</div>`;
    el('revision-form').hidden=role!=='admin'||!['requested','draft','sent'].includes(selected.status);
    if(!el('revision-form').hidden){el('quote-lines').innerHTML='';(rev?.lines||[{}]).forEach(addLine);el('commission').value=rev?.commission_percent||0;el('transport').value=rev?.transport_usd||0;el('terms').value=rev?.terms||'';el('availability-confirmed').checked=false;}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-remove-line]')){event.target.closest('.quote-line').remove();return;}
    const b=event.target.closest('[data-action]');if(!b)return;
    run(async()=>{b.disabled=true;try{
      if(b.dataset.action==='quote')await showQuote(b.dataset.id);
      if(b.dataset.action==='printQuote')printQuoteDocument('quote');
      if(b.dataset.action==='printInvoice')printQuoteDocument('invoice');
      if(b.dataset.action==='sendQuoteEmail')await sendDocument('quote','email');
      if(b.dataset.action==='sendQuoteWhatsapp')await sendDocument('quote','whatsapp');
      if(b.dataset.action==='sendInvoiceEmail')await sendDocument('invoice','email');
      if(b.dataset.action==='sendInvoiceWhatsapp')await sendDocument('invoice','whatsapp');
      if(b.dataset.action==='decision'){await api(`/quotes/${b.dataset.id}/decision`,'POST',{expectedRevision:selected.revision,decision:b.dataset.decision});await showQuote(b.dataset.id);await load();}
      if(b.dataset.action==='cancelQuote'){await api(`/quotes/${b.dataset.id}/cancel`,'POST',{});await showQuote(b.dataset.id);await load();}
      if(b.dataset.action==='convert'){await api(`/quotes/${b.dataset.id}/order`,'POST',{paymentProvider:value('quote-payment')});await showQuote(b.dataset.id);await refreshDirectory();await load();}
      if(b.dataset.action==='mission'){const proof=el('proof-'+b.dataset.id)?.value.trim();await api(`/missions/${b.dataset.id}/status`,'PATCH',{status:b.dataset.next,...(proof?{proof}:{})});await load();}
      if(b.dataset.action==='settlement'){await api(`/settlements/${b.dataset.id}/status`,'PATCH',{status:b.dataset.next,...(b.dataset.next==='paid'?{paymentReference:value('reference-'+b.dataset.id)}:{})});await load();}
      if(b.dataset.action==='audit'){const {events}=await api(`/events/${b.dataset.type}/${b.dataset.id}`);const section=document.createElement('section');section.className='ops-card';section.innerHTML='<h3>Historique</h3>'+events.map(x=>`<p>${date(x.created_at)} · ${escape(labels[x.action]||x.action)}</p>`).join('');b.closest('.ops-card').append(section);}
    }finally{b.disabled=false;}});
  });
  const form=(id,callback)=>el(id).addEventListener('submit',event=>{event.preventDefault();run(async()=>{const button=event.currentTarget.querySelector('button[type="submit"],button:not([type])');if(button)button.disabled=true;try{await callback();}finally{if(button)button.disabled=false;}});});
  form('request-form',async()=>{await api('/quotes','POST',{request:value('request-text'),destination:value('request-destination'),...(role==='admin'?{customerId:value('request-customer')}:{}),...(targetPartner?{targetVendorId:targetPartner.id,...(queryParams.get('trade')?{requestedTradeId:queryParams.get('trade')}:{})}:{})});el('request-form').reset();await load();});
  form('revision-form',async()=>{const lines=[...el('quote-lines').children].map(row=>{const field=k=>row.querySelector(`[data-field="${k}"]`).value.trim();return {description:field('description'),unit:field('unit'),quantity:Number(field('quantity')),basePriceUsd:Number(field('basePriceUsd')),...(field('productId')?{productId:field('productId')} : {}),...(field('vendorId')?{vendorId:field('vendorId')} : {})};});await api(`/quotes/${selected.id}/revisions`,'POST',{expectedRevision:selected.revision,lines,commissionPercent:Number(value('commission')),transportUsd:Number(value('transport')),terms:value('terms'),validUntil:new Date(value('valid-until')).toISOString(),publish:value('publish')==='true',availabilityConfirmed:el('availability-confirmed').checked});await showQuote(selected.id);await load();});
  form('stock-form',async()=>{await api('/stock/'+value('stock-product'),'PATCH',{stock:Number(value('stock-quantity'))});});
  form('mission-form',async()=>{await api('/missions','POST',{orderId:value('mission-order'),carrierVendorId:value('mission-vendor'),...(value('mission-driver')?{driverUserId:value('mission-driver')} : {}),vehicle:value('vehicle'),origin:value('origin'),destination:value('destination'),loadDescription:value('load'),plannedAt:new Date(value('planned')).toISOString()});await load();});
  form('settlement-form',async()=>{await api('/settlements','POST',{orderId:value('settlement-order'),vendorId:value('settlement-vendor'),purpose:value('purpose'),amountUsd:Number(value('amount'))});await load();});
  el('add-line').onclick=()=>addLine();
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{for(const tab of ['quotes','missions','settlements'])el(tab+'-panel').hidden=tab!==button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
  run(async()=>{
    let user;try{user=(await window.apiCall('/auth/me')).user;}catch(e){localStorage.setItem('postLoginRedirect','operations.html'+location.search);location.assign('auth.html');return;}
    role=user.role;if(!['admin','customer','vendor','staff'].includes(role))throw Error('Accès non autorisé');el('identity').textContent='Votre espace de suivi';el('workspace').hidden=false;
    for(const id of ['mission-form','settlement-form','stock-form','customer-field'])el(id).hidden=role!=='admin';
    el('request-form').hidden=!['admin','customer'].includes(role);el('request-customer').required=role==='admin';
    document.querySelector('[data-tab="quotes"]').hidden=!['admin','customer'].includes(role);document.querySelector('[data-tab="settlements"]').hidden=!['admin','vendor'].includes(role);
    if(queryParams.get('partner')&&['admin','customer'].includes(role)){
      try{targetPartner=(await window.apiCall('/partners/'+encodeURIComponent(queryParams.get('partner')))).partner;el('request-target').textContent='Demande adressée à '+targetPartner.business_name+' · Chiffrage coordonné par Chantier.online';el('request-target').hidden=false;}catch(e){el('request-form').hidden=true;throw e;}
    }
    if(role==='admin')await refreshDirectory();await load();document.querySelector(`[data-tab="${['staff','vendor'].includes(role)?'missions':'quotes'}"]`).click();
  });
})();
