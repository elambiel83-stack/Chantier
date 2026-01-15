import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';

function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'buyer',
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setLoading(true);
      const { confirmPassword, ...dataToSend } = formData;
      const response = await api.post('/auth/register', dataToSend);
      Alert.alert('Succès', 'Inscription réussie!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.error || 'Inscription échouée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Inscription</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            style={styles.input}
            placeholder="Votre nom"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="votre@email.com"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            style={styles.input}
            placeholder="+33 6 12 34 56 78"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Type de compte</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}>
              <Picker.Item label="Acheteur" value="buyer" />
              <Picker.Item label="Vendeur" value="seller" />
              <Picker.Item label="Transporteur" value="transporter" />
            </Picker>
          </View>

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
            secureTextEntry
          />

          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChangeText={(text) =>
              setFormData({ ...formData, confirmPassword: text })
            }
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleRegister}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? 'Inscription...' : 'S\'inscrire'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>
              Déjà un compte? Se connecter
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 32,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#2196F3',
    fontSize: 14,
  },
});

export default RegisterScreen;
