// Bot de vente conversationnel pour WhatsApp et Messenger (voir channels/meta.js pour la
// réception/l'envoi de messages bruts). Un menu numéroté plutôt qu'un vrai parseur de
// langage naturel: fiable sur une simple connexion 2G/3G, sans dépendre d'un modèle
// externe ni d'une fenêtre de contexte à maintenir.
//
// État de conversation persisté dans chat_session (une ligne par canal+identifiant
// externe), pour survivre à un redémarrage du serveur entre deux messages.
//
// Volontairement hors périmètre pour cette première version: sélection de devise (tout est
// commandé en USD) et PayPal/CinetPay (redirection vers un navigateur, peu adapté à une
// conversation) — seuls Airtel Money et Orange Money, confirmés manuellement par le staff
// comme sur le web/mobile, sont proposés.
const meta = require('./meta');

const CATEGORIES = [
  { key: 'produits', label: 'Produits (briques, sable, ciment...)' },
  { key: 'services', label: 'Services (livraison, pose, installation...)' },
  { key: 'facilitation', label: 'Facilitation (assistance achat, conseil technique...)' },
  { key: 'partenaires', label: 'Partenaires (transport, équipements...)' }
];

function menuText() {
  const lines = CATEGORIES.map((category, index) => `${index + 1}. ${category.label}`);
  return `Bienvenue chez MonChantier 🧱\nRépondez par un chiffre :\n${lines.join('\n')}\n\nÀ tout moment : "panier" pour voir votre commande.`;
}

function productsText(products) {
  if (!products.length) return 'Aucun produit disponible dans cette catégorie pour le moment.\n\n0. Retour au menu';
  const lines = products.map((product, index) =>
    `${index + 1}. ${product.name_fr} — ${product.price.toFixed(2)} USD/${product.unit}${product.stock ? ` (stock : ${product.stock})` : ' (rupture)'}`
  );
  return `${lines.join('\n')}\n\n0. Retour au menu\nTapez "panier" pour voir votre commande.`;
}

async function cartText(listCatalog, cart) {
  if (!cart.length) return 'Votre panier est vide. Tapez "menu" pour parcourir le catalogue.';
  const catalog = new Map((await listCatalog()).map((product) => [product.id, product]));
  let total = 0;
  const lines = cart.map((item) => {
    const product = catalog.get(item.id);
    const lineTotal = (product?.price || 0) * item.qty;
    total += lineTotal;
    return `${item.qty} x ${product?.name_fr || item.id} — ${lineTotal.toFixed(2)} USD`;
  });
  lines.push(`Total : ${total.toFixed(2)} USD`);
  return `${lines.join('\n')}\n\nTapez "commander" pour valider, "vider" pour vider le panier, ou "menu" pour continuer vos achats.`;
}

const PAYMENT_MENU_TEXT = 'Comment souhaitez-vous payer ?\n1. Airtel Money\n2. Orange Money\n\nTapez "menu" pour annuler.';

function addToCart(cart, productId, qty) {
  const existing = cart.find((item) => item.id === productId);
  if (existing) existing.qty += qty;
  else cart.push({ id: productId, qty });
}

async function getSession(database, channel, externalId) {
  const result = await database.query(
    'SELECT state, cart, context FROM chat_session WHERE channel = $1 AND external_id = $2',
    [channel, externalId]
  );
  if (!result.rowCount) return { state: 'menu', cart: [], context: {} };
  const row = result.rows[0];
  return { state: row.state, cart: row.cart || [], context: row.context || {} };
}

async function saveSession(database, channel, externalId, session) {
  await database.query(
    `INSERT INTO chat_session (channel, external_id, state, cart, context, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (channel, external_id) DO UPDATE SET state = $3, cart = $4, context = $5, updated_at = now()`,
    [channel, externalId, session.state, JSON.stringify(session.cart), JSON.stringify(session.context)]
  );
}

// Un même numéro de téléphone reste le même client, qu'il commande via le web, l'app ou
// WhatsApp: on le retrouve par téléphone plutôt que de dupliquer une fiche à chaque canal.
async function findOrCreateCustomerByPhone(database, phone) {
  const existing = await database.query('SELECT id FROM customer WHERE phone = $1 LIMIT 1', [phone]);
  if (existing.rowCount) return existing.rows[0].id;
  const created = await database.query('INSERT INTO customer (phone) VALUES ($1) RETURNING id', [phone]);
  return created.rows[0].id;
}

function createSalesBot({ database, createOrder, listCatalog, MOBILE_MONEY_PROVIDERS, captureError, captureSecurityEvent }) {
  async function reply(channel, externalId, text) {
    try {
      await meta.sendText(channel, externalId, text);
    } catch (error) {
      captureError(error);
    }
  }

  async function handleOne({ channel, externalId, text }) {
    const session = await getSession(database, channel, externalId);
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // Commandes globales: valables depuis n'importe quel état, y compris pour annuler un
    // paiement en cours de saisie.
    if (lower === 'menu') {
      session.state = 'menu';
      session.cart = session.cart || [];
      session.context = {};
      await saveSession(database, channel, externalId, session);
      return reply(channel, externalId, menuText());
    }
    if (lower === 'panier' || lower === 'cart') {
      session.state = 'cart';
      await saveSession(database, channel, externalId, session);
      return reply(channel, externalId, await cartText(listCatalog, session.cart));
    }

    if (session.state === 'category') {
      if (trimmed === '0') {
        session.state = 'menu';
        session.context = {};
        await saveSession(database, channel, externalId, session);
        return reply(channel, externalId, menuText());
      }
      const products = await listCatalog({ category: session.context.category });
      const index = Number.parseInt(trimmed, 10) - 1;
      const product = Number.isInteger(index) ? products[index] : undefined;
      if (!product) {
        return reply(channel, externalId, `Numéro invalide.\n\n${productsText(products)}`);
      }
      if (!product.stock) {
        return reply(channel, externalId, `${product.name_fr} est en rupture de stock pour le moment.\n\n${productsText(products)}`);
      }
      session.state = 'awaiting_qty';
      session.context = { category: session.context.category, productId: product.id, productName: product.name_fr };
      await saveSession(database, channel, externalId, session);
      return reply(channel, externalId, `Quelle quantité pour ${product.name_fr} (${product.unit}) ?`);
    }

    if (session.state === 'awaiting_qty') {
      const qty = Number.parseInt(trimmed, 10);
      if (!Number.isInteger(qty) || qty <= 0) {
        return reply(channel, externalId, `Merci d'indiquer une quantité valide (nombre entier positif) pour ${session.context.productName}.`);
      }
      addToCart(session.cart, session.context.productId, qty);
      const products = await listCatalog({ category: session.context.category });
      session.state = 'category';
      session.context = { category: session.context.category };
      await saveSession(database, channel, externalId, session);
      return reply(channel, externalId, `Ajouté : ${qty} x ${products.find((p) => p.id === session.context.productId)?.name_fr || session.context.productId}.\n\n${productsText(products)}`);
    }

    if (session.state === 'cart') {
      if (lower === 'commander') {
        if (!session.cart.length) return reply(channel, externalId, 'Votre panier est vide. Tapez "menu" pour parcourir le catalogue.');
        session.state = 'checkout_name';
        await saveSession(database, channel, externalId, session);
        return reply(channel, externalId, 'Quel est votre nom complet ?');
      }
      if (lower === 'vider') {
        session.cart = [];
        session.state = 'menu';
        await saveSession(database, channel, externalId, session);
        return reply(channel, externalId, `Panier vidé.\n\n${menuText()}`);
      }
      return reply(channel, externalId, 'Tapez "commander" pour valider, "vider" pour vider le panier, ou "menu" pour continuer vos achats.');
    }

    if (session.state === 'checkout_name') {
      if (!trimmed) return reply(channel, externalId, 'Merci d’indiquer votre nom complet.');
      session.context.fullName = trimmed;
      session.state = 'checkout_phone';
      await saveSession(database, channel, externalId, session);
      return reply(channel, externalId, 'Quel est votre numéro de téléphone pour la livraison ?');
    }

    if (session.state === 'checkout_phone') {
      const phone = trimmed.replace(/[^\d+]/g, '');
      if (phone.length < 6) return reply(channel, externalId, 'Merci d’indiquer un numéro de téléphone valide.');
      session.context.phone = phone;
      session.state = 'checkout_payment';
      await saveSession(database, channel, externalId, session);
      return reply(channel, externalId, PAYMENT_MENU_TEXT);
    }

    if (session.state === 'checkout_payment') {
      const paymentProvider = { '1': 'airtel_money', '2': 'orange_money' }[trimmed];
      if (!paymentProvider) return reply(channel, externalId, PAYMENT_MENU_TEXT);
      try {
        const customerId = await findOrCreateCustomerByPhone(database, session.context.phone);
        const { order, payment } = await createOrder({
          customerId,
          customer: { fullName: session.context.fullName, phone: session.context.phone },
          currency: 'USD',
          paymentProvider,
          items: session.cart
        });
        session.state = 'menu';
        session.cart = [];
        session.context = {};
        await saveSession(database, channel, externalId, session);
        const provider = MOBILE_MONEY_PROVIDERS[paymentProvider];
        return reply(
          channel,
          externalId,
          `Commande créée ✅ Référence : ${order.id}\nMontant : ${Number(order.total_amount).toFixed(2)} ${order.currency}\n\n` +
          `Envoyez le paiement via ${provider.label} au ${provider.payoutNumber} en indiquant cette référence. ` +
          `Votre commande sera confirmée après vérification par notre équipe.`
        );
      } catch (error) {
        if (error.status) {
          session.state = 'cart';
          await saveSession(database, channel, externalId, session);
          return reply(channel, externalId, `${error.message}\n\n${await cartText(listCatalog, session.cart)}`);
        }
        captureError(error);
        session.state = 'cart';
        await saveSession(database, channel, externalId, session);
        return reply(channel, externalId, 'Une erreur est survenue lors de la création de votre commande. Réessayez ou contactez-nous directement.');
      }
    }

    // État 'menu' (ou tout état inconnu, ex. session jamais initialisée): un chiffre
    // 1-4 choisit une catégorie, tout le reste réaffiche le menu.
    const categoryIndex = Number.parseInt(trimmed, 10) - 1;
    const category = CATEGORIES[categoryIndex];
    if (!category) {
      return reply(channel, externalId, menuText());
    }
    const products = await listCatalog({ category: category.key });
    session.state = 'category';
    session.context = { category: category.key };
    session.cart = session.cart || [];
    await saveSession(database, channel, externalId, session);
    return reply(channel, externalId, productsText(products));
  }

  async function handleWebhook(req, res) {
    // Meta réessaie si la réponse tarde ou échoue: on répond 200 tout de suite et on
    // traite les messages ensuite, sans faire attendre l'accusé de réception sur la
    // création éventuelle d'une commande.
    res.sendStatus(200);
    const signature = req.get('x-hub-signature-256');
    if (!meta.verifySignature(req.rawBody, signature, process.env.META_APP_SECRET)) {
      captureSecurityEvent('Signature de webhook Meta invalide', { path: req.path });
      return;
    }
    const messages = meta.extractIncomingMessages(req.body);
    for (const message of messages) {
      try {
        await handleOne(message);
      } catch (error) {
        captureError(error);
      }
    }
  }

  function handleVerification(req, res) {
    const challenge = meta.verifyHandshake(
      { mode: req.query['hub.mode'], token: req.query['hub.verify_token'], challenge: req.query['hub.challenge'] },
      process.env.META_VERIFY_TOKEN
    );
    if (challenge === null) return res.sendStatus(403);
    res.status(200).send(challenge);
  }

  return { handleWebhook, handleVerification };
}

module.exports = { createSalesBot };
