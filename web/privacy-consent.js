(() => {
  const KEY='monchantier_privacy_v1';
  const banner=document.getElementById('privacy-choice');
  function read(){ try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;} }
  function save(ads){ localStorage.setItem(KEY,JSON.stringify({ads:Boolean(ads),version:1,updatedAt:new Date().toISOString()})); if(banner) banner.hidden=true; if(ads) loadAds(); }
  function loadAds(){
    if(document.querySelector('script[data-monchantier-google-ads]')) return;
    window.dataLayer=window.dataLayer||[];
    window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
    window.gtag('js',new Date());
    const s=document.createElement('script'); s.async=true; s.src='https://www.googletagmanager.com/gtag/js?id=AW-18453977660'; s.dataset.monchantierGoogleAds='1';
    s.onload=()=>window.gtag('config','AW-18453977660');
    document.head.appendChild(s);
  }
  const choice=read();
  if(choice){ if(banner) banner.hidden=true; if(choice.ads===true) loadAds(); }
  document.getElementById('privacy-reject')?.addEventListener('click',()=>save(false));
  document.getElementById('privacy-accept-ads')?.addEventListener('click',()=>save(true));
  window.MonChantierPrivacy={preferences:()=>read(),setAdvertising:save};
})();
