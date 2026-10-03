(function () {
  const el=id=>document.getElementById(id);
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={requested:'Demande reçue',draft:'Brouillon',sent:'À accepter',accepted:'Accepté',rejected:'Refusé',assigned:'Attribuée',in_transit:'En route',delivered:'Livrée',completed:'Terminée',cancelled:'Annulé',due:'À régler',paid:'Réglé'};
  const money=v=>Number(v||0).toLocaleString('fr-FR',{style:'currency',currency:'USD'});
  const date=v=>v?new Date(v).toLocaleString('fr-FR'):'—';
  const options=(items,label='label')=>'<option value="">Choisir</option>'+items.map(x=>`<option value="${escape(x.id)}">${escape(x[label])}</option>`).join('');
  const api=(path,method='GET',body)=>window.apiCall('/btp'+path,{method,...(body===undefined?{}:{body})});
  const value=id=>el(id).value.trim();
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
  async function showQuote(id){
    const data=await api('/quotes/'+id);selected=data.quote;const rev=data.revisions.at(-1);const detail=el('quote-detail');detail.hidden=false;
    detail.innerHTML=`<h3>Devis ${escape(id.slice(0,8))} · ${escape(labels[selected.status])}</h3><p>${escape(selected.request)}</p><p>Destination : ${escape(selected.destination)}</p>${rev?`<p>Version ${rev.revision} · Valable jusqu’au ${date(rev.valid_until)}</p><ul>${rev.lines.map(l=>`<li>${escape(l.description)} : ${escape(l.quantity)} ${escape(l.unit)}</li>`).join('')}</ul><p>Conditions : ${escape(rev.terms)}</p><p>Transport : ${money(rev.transport_usd)} · <strong>Total : ${money(rev.total_usd)}</strong></p>`:'<p>Prix en préparation.</p>'}<div class="ops-actions">${role==='customer'&&selected.status==='sent'?`${button('decision',id,'Accepter cette version','data-decision="accepted"')}${button('decision',id,'Refuser','data-decision="rejected"')}`:''}${role==='admin'&&selected.status==='accepted'&&!selected.order_id?`<label>Paiement convenu<select id="quote-payment"><option value="airtel_money">Airtel Money</option><option value="orange_money">Orange Money</option><option value="paypal">PayPal</option><option value="cinetpay">CinetPay</option></select></label>${button('convert',id,'Créer la commande et réserver le stock')}`:''}${selected.order_id?'<a href="orders.html">Consulter la commande</a>':''}${role==='admin'&&!selected.order_id&&!['cancelled','rejected'].includes(selected.status)?button('cancelQuote',id,'Annuler le devis'):''}${role==='admin'?button('audit',id,'Historique','data-type="quote"'):''}</div>`;
    el('revision-form').hidden=role!=='admin'||!['requested','draft','sent'].includes(selected.status);
    if(!el('revision-form').hidden){el('quote-lines').innerHTML='';(rev?.lines||[{}]).forEach(addLine);el('commission').value=rev?.commission_percent||0;el('transport').value=rev?.transport_usd||0;el('terms').value=rev?.terms||'';el('availability-confirmed').checked=false;}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-remove-line]')){event.target.closest('.quote-line').remove();return;}
    const b=event.target.closest('[data-action]');if(!b)return;
    run(async()=>{b.disabled=true;try{
      if(b.dataset.action==='quote')await showQuote(b.dataset.id);
      if(b.dataset.action==='decision'){await api(`/quotes/${b.dataset.id}/decision`,'POST',{expectedRevision:selected.revision,decision:b.dataset.decision});await showQuote(b.dataset.id);await load();}
      if(b.dataset.action==='cancelQuote'){await api(`/quotes/${b.dataset.id}/cancel`,'POST',{});await showQuote(b.dataset.id);await load();}
      if(b.dataset.action==='convert'){await api(`/quotes/${b.dataset.id}/order`,'POST',{paymentProvider:value('quote-payment')});await showQuote(b.dataset.id);await refreshDirectory();await load();}
      if(b.dataset.action==='mission'){const proof=el('proof-'+b.dataset.id)?.value.trim();await api(`/missions/${b.dataset.id}/status`,'PATCH',{status:b.dataset.next,...(proof?{proof}:{})});await load();}
      if(b.dataset.action==='settlement'){await api(`/settlements/${b.dataset.id}/status`,'PATCH',{status:b.dataset.next,...(b.dataset.next==='paid'?{paymentReference:value('reference-'+b.dataset.id)}:{})});await load();}
      if(b.dataset.action==='audit'){const {events}=await api(`/events/${b.dataset.type}/${b.dataset.id}`);const section=document.createElement('section');section.className='ops-card';section.innerHTML='<h3>Historique</h3>'+events.map(x=>`<p>${date(x.created_at)} · ${escape(labels[x.action]||x.action)}</p>`).join('');b.closest('.ops-card').append(section);}
    }finally{b.disabled=false;}});
  });
  const form=(id,callback)=>el(id).addEventListener('submit',event=>{event.preventDefault();run(async()=>{const button=event.currentTarget.querySelector('button[type="submit"],button:not([type])');if(button)button.disabled=true;try{await callback();}finally{if(button)button.disabled=false;}});});
  form('request-form',async()=>{await api('/quotes','POST',{request:value('request-text'),destination:value('request-destination'),...(role==='admin'?{customerId:value('request-customer')}:{})});el('request-form').reset();await load();});
  form('revision-form',async()=>{const lines=[...el('quote-lines').children].map(row=>{const field=k=>row.querySelector(`[data-field="${k}"]`).value.trim();return {description:field('description'),unit:field('unit'),quantity:Number(field('quantity')),basePriceUsd:Number(field('basePriceUsd')),...(field('productId')?{productId:field('productId')} : {}),...(field('vendorId')?{vendorId:field('vendorId')} : {})};});await api(`/quotes/${selected.id}/revisions`,'POST',{expectedRevision:selected.revision,lines,commissionPercent:Number(value('commission')),transportUsd:Number(value('transport')),terms:value('terms'),validUntil:new Date(value('valid-until')).toISOString(),publish:value('publish')==='true',availabilityConfirmed:el('availability-confirmed').checked});await showQuote(selected.id);await load();});
  form('stock-form',async()=>{await api('/stock/'+value('stock-product'),'PATCH',{stock:Number(value('stock-quantity'))});});
  form('mission-form',async()=>{await api('/missions','POST',{orderId:value('mission-order'),carrierVendorId:value('mission-vendor'),...(value('mission-driver')?{driverUserId:value('mission-driver')} : {}),vehicle:value('vehicle'),origin:value('origin'),destination:value('destination'),loadDescription:value('load'),plannedAt:new Date(value('planned')).toISOString()});await load();});
  form('settlement-form',async()=>{await api('/settlements','POST',{orderId:value('settlement-order'),vendorId:value('settlement-vendor'),purpose:value('purpose'),amountUsd:Number(value('amount'))});await load();});
  el('add-line').onclick=()=>addLine();
  document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{for(const tab of ['quotes','missions','settlements'])el(tab+'-panel').hidden=tab!==button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
  run(async()=>{
    let user;try{user=(await window.apiCall('/auth/me')).user;}catch(e){localStorage.setItem('postLoginRedirect','operations.html');location.assign('auth.html');return;}
    role=user.role;if(!['admin','customer','vendor','staff'].includes(role))throw Error('Accès non autorisé');el('identity').textContent='Votre espace de suivi';el('workspace').hidden=false;
    for(const id of ['mission-form','settlement-form','stock-form','customer-field'])el(id).hidden=role!=='admin';
    el('request-form').hidden=!['admin','customer'].includes(role);el('request-customer').required=role==='admin';
    document.querySelector('[data-tab="quotes"]').hidden=!['admin','customer'].includes(role);document.querySelector('[data-tab="settlements"]').hidden=!['admin','vendor'].includes(role);
    if(role==='admin')await refreshDirectory();await load();document.querySelector(`[data-tab="${['staff','vendor'].includes(role)?'missions':'quotes'}"]`).click();
  });
})();
