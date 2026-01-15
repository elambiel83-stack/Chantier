import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/Transport.css';

function Transport() {
  const [transports, setTransports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransports();
  }, []);

  const fetchTransports = async () => {
    try {
      const response = await api.get('/transport');
      setTransports(response.data.transports || []);
    } catch (error) {
      console.error('Error fetching transports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  return (
    <div className="transport-page">
      <h1>Transport et Livraison</h1>

      <div className="transport-info">
        <h2>Services de Transport</h2>
        <p>
          Nous offrons des services de transport et de livraison fiables 
          pour tous vos matériaux de construction partout dans le monde.
        </p>
      </div>

      <div className="transport-types">
        <div className="transport-type-card">
          <h3>🚚 Transport Standard</h3>
          <p>Livraison en 5-7 jours ouvrables</p>
        </div>
        <div className="transport-type-card">
          <h3>⚡ Transport Express</h3>
          <p>Livraison en 2-3 jours ouvrables</p>
        </div>
        <div className="transport-type-card">
          <h3>🏗️ Transport Charges Lourdes</h3>
          <p>Pour matériaux volumineux et lourds</p>
        </div>
        <div className="transport-type-card">
          <h3>📦 Transport Spécial</h3>
          <p>Pour matériaux fragiles ou dangereux</p>
        </div>
      </div>

      {transports.length > 0 && (
        <div className="transport-list">
          <h2>Mes Transports</h2>
          {transports.map(transport => (
            <div key={transport._id} className="transport-card">
              <div className="transport-header">
                <h3>Transport #{transport._id.slice(-8)}</h3>
                <span className={`status-badge ${transport.status}`}>
                  {transport.status}
                </span>
              </div>
              <div className="transport-body">
                <p>Type: {transport.type}</p>
                {transport.pickup?.location && (
                  <p>De: {transport.pickup.location.city}</p>
                )}
                {transport.delivery?.location && (
                  <p>À: {transport.delivery.location.city}</p>
                )}
                {transport.cost && (
                  <p>Coût: {transport.cost.amount} {transport.cost.currency}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Transport;
