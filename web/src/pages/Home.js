import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Home.css';

function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>Bienvenue sur Chantier</h1>
          <p className="hero-subtitle">
            Votre marketplace professionnel pour matériaux de construction
          </p>
          <p className="hero-description">
            Achetez et vendez des matériaux de construction, organisez le transport 
            et la livraison partout dans le monde.
          </p>
          <div className="hero-buttons">
            <Link to="/products" className="btn-primary btn-large">
              Découvrir les produits
            </Link>
            <Link to="/register" className="btn-secondary btn-large">
              Devenir vendeur
            </Link>
          </div>
        </div>
      </section>

      <section className="features">
        <h2>Pourquoi choisir Chantier ?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🏪</div>
            <h3>Marketplace complet</h3>
            <p>
              Large sélection de matériaux de construction de qualité 
              provenant de vendeurs vérifiés du monde entier.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🚚</div>
            <h3>Transport intégré</h3>
            <p>
              Organisation du transport et suivi de livraison en temps réel 
              pour tous vos achats.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🌍</div>
            <h3>Portée mondiale</h3>
            <p>
              Connectez-vous avec des acheteurs et vendeurs partout dans le monde 
              pour vos projets de construction.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💳</div>
            <h3>Paiement sécurisé</h3>
            <p>
              Transactions sécurisées avec plusieurs options de paiement 
              pour votre tranquillité d'esprit.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⭐</div>
            <h3>Système d'évaluation</h3>
            <p>
              Notations et avis vérifiés pour vous aider à faire 
              les meilleurs choix.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>App mobile</h3>
            <p>
              Gérez vos commandes en déplacement avec nos applications 
              Android et iOS.
            </p>
          </div>
        </div>
      </section>

      <section className="categories">
        <h2>Catégories populaires</h2>
        <div className="categories-grid">
          <Link to="/products?category=cement" className="category-card">
            <div className="category-icon">🏗️</div>
            <h3>Ciment</h3>
          </Link>
          <Link to="/products?category=bricks" className="category-card">
            <div className="category-icon">🧱</div>
            <h3>Briques</h3>
          </Link>
          <Link to="/products?category=steel" className="category-card">
            <div className="category-icon">🔩</div>
            <h3>Acier</h3>
          </Link>
          <Link to="/products?category=wood" className="category-card">
            <div className="category-icon">🪵</div>
            <h3>Bois</h3>
          </Link>
          <Link to="/products?category=roofing" className="category-card">
            <div className="category-icon">🏠</div>
            <h3>Toiture</h3>
          </Link>
          <Link to="/products?category=tools" className="category-card">
            <div className="category-icon">🔧</div>
            <h3>Outils</h3>
          </Link>
        </div>
      </section>

      <section className="cta">
        <div className="cta-content">
          <h2>Prêt à commencer ?</h2>
          <p>Rejoignez des milliers de professionnels qui font confiance à Chantier</p>
          <Link to="/register" className="btn-primary btn-large">
            S'inscrire maintenant
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Home;
