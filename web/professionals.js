(function(){
 const el=id=>document.getElementById(id),escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const availability={available:'Disponible',limited:'Disponibilité limitée',unavailable:'Indisponible actuellement'};
 let trades=[],page=1,filters={},busy=false;
 const status=(message,error=false)=>{el('directory-status').textContent=message;el('directory-status').className=error?'ops-error':'';};
 async function search(append=false){if(busy)return;busy=true;el('load-more').disabled=true;try{
  if(!append){page=1;el('professional-detail').hidden=true;filters={};for(const [key,id] of [['trade','filter-trade'],['q','filter-query'],['zone','filter-zone'],['availability','filter-availability']])if(el(id).value.trim())filters[key]=el(id).value.trim();}
  const query=new URLSearchParams({...filters,page});const {partners,hasMore}=await window.apiCall('/partners?'+query);
  const html=partners.map(p=>`<article class="ops-card"><h2>${escape(p.business_name)}</h2><p>${p.trade_ids.map(id=>escape(trades.find(t=>t.id===id)?.label||id)).join(' · ')}</p><p>${p.zones.map(escape).join(' · ')} — ${escape(availability[p.availability])}</p><p>${escape(p.description)}</p><button data-partner="${escape(p.id)}">Voir la fiche et demander un devis</button></article>`).join('');
  if(append)el('professionals-list').insertAdjacentHTML('beforeend',html);else el('professionals-list').innerHTML=html||'<p>Aucun partenaire publié ne correspond à cette recherche. <a href="operations.html">Créer une demande générale</a>.</p>';
  el('load-more').hidden=!hasMore;status('Résultats de la recherche.');
 }catch(err){if(append)page--;status(err.message,true);}finally{busy=false;el('load-more').disabled=false;}}
 el('search-form').onsubmit=e=>{e.preventDefault();search();};el('load-more').onclick=()=>{page++;search(true);};
 el('professionals-list').addEventListener('click',async e=>{const button=e.target.closest('[data-partner]');if(!button)return;button.disabled=true;try{
  const {partner:p}=await window.apiCall('/partners/'+button.dataset.partner);const detail=el('professional-detail');
  const target=new URLSearchParams({partner:p.id,...(filters.trade?{trade:filters.trade}:{})});
  detail.innerHTML=`<h2>${escape(p.business_name)}</h2><p>${escape(p.description)}</p><h3>Spécialités</h3><p>${p.specialties.map(escape).join(' · ')||'À préciser'}</p><h3>Zones</h3><p>${p.zones.map(escape).join(' · ')}</p><h3>Réalisations et références déclarées</h3><p>${escape(p.references_text)||'À préciser'}</p><h3>Conditions tarifaires indicatives</h3><p>${escape(p.rate_notes)||'Sur devis'}</p><p>${escape(availability[p.availability])}</p><a class="ops-link-button" href="operations.html?${escape(target.toString())}">Demander un devis à ce partenaire</a>`;
  detail.hidden=false;detail.scrollIntoView?.({behavior:'smooth',block:'start'});
 }catch(err){status(err.message,true);}finally{button.disabled=false;}});
 (async()=>{try{({trades}=await window.apiCall('/trades'));el('filter-trade').innerHTML='<option value="">Tous les métiers</option>'+trades.map(t=>`<option value="${escape(t.id)}">${escape(t.label)}</option>`).join('');await search();}catch(err){status(err.message,true);}})();
})();
