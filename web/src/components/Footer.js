import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h3>Chantier</h3>
          <p>Votre marketplace pour matériaux de construction, transport et livraison à travers le monde.</p>
        </div>

        <div className="footer-section">
          <h4>Liens rapides</h4>
          <ul>
            <li><Link to="/products">Produits</Link></li>
            <li><Link to="/transport">Transport</Link></li>
            <li><Link to="/register">Devenir vendeur</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Support</h4>
          <ul>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
            <li><Link to="/terms">Conditions d'utilisation</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Suivez-nous</h4>
          <div className="social-links">
            <a href="#facebook">Facebook</a>
            <a href="#twitter">Twitter</a>
            <a href="#linkedin">LinkedIn</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; 2026 Chantier. Tous droits réservés.</p>
      </div>
    </footer>
  );
}

export default Footer;
