import React from 'react';
import { Link } from 'react-router-dom';
import { FaShoppingCart, FaUser } from 'react-icons/fa';
import '../styles/Header.css';

function Header() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <h1>🏗️ Chantier</h1>
        </Link>
        
        <nav className="nav">
          <Link to="/" className="nav-link">Accueil</Link>
          <Link to="/products" className="nav-link">Produits</Link>
          <Link to="/transport" className="nav-link">Transport</Link>
          {isLoggedIn ? (
            <>
              <Link to="/orders" className="nav-link">Commandes</Link>
              <Link to="/seller/dashboard" className="nav-link">Tableau de bord</Link>
            </>
          ) : null}
        </nav>

        <div className="header-actions">
          <Link to="/cart" className="icon-link">
            <FaShoppingCart size={24} />
          </Link>
          {isLoggedIn ? (
            <Link to="/buyer/dashboard" className="icon-link">
              <FaUser size={24} />
            </Link>
          ) : (
            <Link to="/login" className="btn-primary">
              Connexion
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
