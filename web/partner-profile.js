(function(){
 const el=id=>document.getElementById(id),escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const status=(text,error=false)=>{el('profile-status').textContent=text;el('profile-status').className=error?'ops-error':'';};
 const lines=id=>el(id).value.split('\n').map(x=>x.trim()).filter(Boolean);
 el('profile-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;try{
  await window.apiCall('/vendor/profile',{method:'PUT',body:{tradeIds:[...document.querySelectorAll('[name="trade"]:checked')].map(x=>x.value),specialties:lines('specialties'),zones:lines('zones'),description:el('description').value.trim(),references:el('references').value.trim(),rateNotes:el('rate-notes').value.trim(),availability:el('availability').value,published:el('published').checked}});status('Fiche enregistrée. '+(el('published').checked?'Elle est visible dans l’annuaire.':'Elle reste privée.'));
 }catch(err){status(err.message,true);}finally{button.disabled=false;}});
 (async()=>{try{
  const {user}=await window.apiCall('/auth/me');if(user.role!=='vendor')throw Error('Cet espace est réservé aux partenaires inscrits.');
  const results=await Promise.allSettled([window.apiCall('/trades'),window.apiCall('/vendor/profile'),window.apiCall('/vendor/quote-requests')]);for(const r of results)if(r.status==='rejected')throw r.reason;
  const [{trades},{vendor,profile},{requests}]=results.map(x=>x.value);
  el('trade-options').innerHTML=trades.map(t=>`<label class="ops-check"><input type="checkbox" name="trade" value="${escape(t.id)}" ${profile?.trade_ids.includes(t.id)?'checked':''}>${escape(t.label)}</label>`).join('');
  for(const [id,key] of [['specialties','specialties'],['zones','zones'],['description','description'],['references','references_text'],['rate-notes','rate_notes'],['availability','availability']])if(profile)el(id).value=Array.isArray(profile[key])?profile[key].join('\n'):profile[key];
  el('published').checked=profile?.published||false;el('profile-form').hidden=false;el('targeted-section').hidden=false;
  el('targeted-requests').innerHTML=requests.map(q=>`<article class="ops-card"><strong>Demande ${escape(q.id.slice(0,8))}</strong><p>${escape(q.request)}</p><p>Destination : ${escape(q.destination)}</p><p>Statut : ${escape(q.status)}</p></article>`).join('')||'<p>Aucune demande ciblée pour le moment.</p>';status(vendor.business_name);
 }catch(err){status(err.message||'Connectez-vous avec votre compte partenaire.',true);}})();
})();
