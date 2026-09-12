import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  TextInput,
} from 'react-native';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function CartScreen({ navigation }) {
  const { cart, removeFromCart, updateQuantity, getTotal, clearCart, currency, setCurrency, formatAmount } = useCart();
  const { authFetch, isAuthenticated, logout } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [paymentProvider, setPaymentProvider] = useState('airtel_money');
  const [submitting, setSubmitting] = useState(false);

  const promptForLogin = () => {
    Alert.alert(
      'Connexion requise',
      'Créez un compte ou connectez-vous pour finaliser votre commande.',
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Se connecter', onPress: () => { logout(); } },
      ]
    );
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      promptForLogin();
      return;
    }
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('Informations requises', 'Saisissez votre nom complet et votre numéro de téléphone.');
      return;
    }
    if (paymentProvider === 'paypal' && currency === 'CDF') {
      Alert.alert('Devise non prise en charge', 'PayPal est disponible en USD ou EUR.');
      return;
    }
    if (paymentProvider === 'cinetpay' && currency === 'EUR') {
      Alert.alert('Devise non prise en charge', 'CinetPay est disponible en USD ou CDF.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await authFetch('/orders', {
        method: 'POST',
        body: {
          customer: { fullName: fullName.trim(), phone: phone.trim(), email: email.trim() || undefined },
          currency,
          paymentProvider,
          items: cart.map((item) => ({ id: item.id, qty: item.quantity })),
        },
      });

      if (paymentProvider === 'paypal' || paymentProvider === 'cinetpay') {
        const providerLabel = paymentProvider === 'paypal' ? 'PayPal' : 'CinetPay';
        const paymentData = await authFetch(`/orders/${data.order.id}/${paymentProvider}`, { method: 'POST' });
        const redirectUrl = paymentProvider === 'paypal' ? paymentData.approvalUrl : paymentData.paymentUrl;
        if (!redirectUrl) throw new Error(`Paiement ${providerLabel} indisponible`);
        await Linking.openURL(redirectUrl);
        // Le panier reste intact tant que la confirmation du prestataire n'est pas faite.
        Alert.alert(`Paiement ${providerLabel}`, 'Finalisez le paiement dans votre navigateur pour confirmer la commande.');
        return;
      }

      clearCart();
      setFullName('');
      setPhone('');
      setEmail('');
      const payment = data.payment;
      Alert.alert(
        'Commande créée',
        payment
          ? `Référence : ${payment.reference}\nEnvoyez le paiement via ${payment.label} au ${payment.payoutNumber}. Votre commande sera confirmée après vérification.`
          : `Référence : ${data.order.id}`
      );
    } catch (error) {
      if (error.status === 401) {
        promptForLogin();
        return;
      }
      Alert.alert('Erreur de commande', error.message || 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <Image source={{ uri: item.img }} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name_fr}</Text>
        <Text style={styles.itemId}>{item.id} · {item.unit}</Text>
        <Text style={styles.itemPrice}>{formatAmount(item.price)} × {item.quantity}</Text>
        <Text style={styles.itemTotal}>{formatAmount(item.price * item.quantity)}</Text>
      </View>
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.id, item.quantity - 1)}
        >
          <Text style={styles.quantityButtonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.quantity}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateQuantity(item.id, item.quantity + 1)}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeFromCart(item.id)}
      >
        <Text style={styles.removeButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  if (cart.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyText}>Votre panier est vide</Text>
        <TouchableOpacity
          style={styles.shopButton}
          onPress={() => navigation.navigate('Products')}
        >
          <Text style={styles.shopButtonText}>Parcourir le catalogue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cart}
        renderItem={renderCartItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.cartList}
      />
      
      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>{formatAmount(getTotal())}</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Nom complet"
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={styles.input}
          placeholder="Téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="E-mail (facultatif)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.selectionLabel}>Devise</Text>
        <View style={styles.optionRow}>
          {['USD', 'CDF', 'EUR'].map((option) => (
            <TouchableOpacity key={option} style={[styles.option, currency === option && styles.optionSelected]} onPress={() => setCurrency(option)}>
              <Text style={currency === option ? styles.optionTextSelected : styles.optionText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.selectionLabel}>Moyen de paiement</Text>
        <View style={styles.optionRow}>
          <TouchableOpacity style={[styles.option, paymentProvider === 'airtel_money' && styles.optionSelected]} onPress={() => setPaymentProvider('airtel_money')}>
            <Text style={paymentProvider === 'airtel_money' ? styles.optionTextSelected : styles.optionText}>Airtel Money</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.option, paymentProvider === 'orange_money' && styles.optionSelected]} onPress={() => setPaymentProvider('orange_money')}>
            <Text style={paymentProvider === 'orange_money' ? styles.optionTextSelected : styles.optionText}>Orange Money</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.option, paymentProvider === 'paypal' && styles.optionSelected]} onPress={() => setPaymentProvider('paypal')}>
            <Text style={paymentProvider === 'paypal' ? styles.optionTextSelected : styles.optionText}>PayPal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.option, paymentProvider === 'cinetpay' && styles.optionSelected]} onPress={() => setPaymentProvider('cinetpay')}>
            <Text style={paymentProvider === 'cinetpay' ? styles.optionTextSelected : styles.optionText}>CinetPay</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, submitting && styles.checkoutButtonDisabled]}
          onPress={handleCheckout}
          disabled={submitting}
        >
          <Text style={styles.checkoutButtonText}>{submitting ? 'Création de la commande...' : 'Créer la commande'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            Alert.alert(
              'Vider le panier',
              'Êtes-vous sûr de vouloir vider le panier?',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Vider', onPress: clearCart, style: 'destructive' },
              ]
            );
          }}
        >
          <Text style={styles.clearButtonText}>Vider le panier</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Le total final et les instructions de paiement sont confirmés par MonChantier.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartList: {
    padding: 16,
    gap: 12,
  },
  cartItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  itemId: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc2626',
    marginTop: 4,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    backgroundColor: '#f1f5f9',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  quantity: {
    fontSize: 16,
    fontWeight: 'bold',
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    fontSize: 20,
  },
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    color: '#1e293b',
  },
  selectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 4,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  optionText: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  checkoutButton: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  checkoutButtonDisabled: {
    opacity: 0.6,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButtonText: {
    color: '#64748b',
    fontSize: 14,
  },
  footerNote: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});
