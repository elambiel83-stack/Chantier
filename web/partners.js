(function () {
  const form = document.getElementById('partner-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const value = (id) => document.getElementById(id).value.trim();
    const message = ['Bonjour Chantier.online,', `Rôle : ${value('partner-role')}`, `Nom / entreprise : ${value('partner-name')}`, `Téléphone : ${value('partner-phone')}`, `Ville et zones : ${value('partner-zone')}`, `Détails : ${value('partner-details')}`].join('\n');
    window.open('https://wa.me/243840468602?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
    document.getElementById('partner-status').textContent = 'Vérifiez le message dans WhatsApp puis envoyez-le pour transmettre votre demande.';
  });
})();
