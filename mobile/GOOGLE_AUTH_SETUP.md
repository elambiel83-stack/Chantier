# Configuration Google OAuth pour MonChantier Mobile

## 📋 Étapes de Configuration

### 1. Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet appelé "MonChantier"
3. Attendez la création du projet

### 2. Configurer OAuth 2.0

1. Allez à **APIs & Services** > **Credentials**
2. Cliquez sur **Create Credentials** > **OAuth Client ID**
3. Sélectionnez **Application type** : **Android** et **iOS**

### 3. Configuration Android

1. Pour Android, vous avez besoin du SHA-1 fingerprint
2. Générez-le avec :
   ```bash
   cd android
   ./gradlew signingReport
   ```
3. Copiez le SHA-1 fingerprint
4. Collez-le dans Google Cloud Console
5. Téléchargez le fichier `google-services.json`
6. Placez-le dans `android/app/`

### 4. Configuration iOS

1. Pour iOS, vous avez besoin du Bundle ID : `com.monchantier.app`
2. Téléchargez le fichier `GoogleService-Info.plist`
3. Placez-le dans le projet Xcode

### 5. Mettre à jour App.js

Remplacez les placeholders dans [App.js](App.js) :

```javascript
const [request, response, promptAsync] = Google.useAuthRequest({
  clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // ← À remplacer
  iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com', // ← À remplacer
  androidClientId: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com', // ← À remplacer
});
```

Avec les ID fournis par Google Cloud Console.

### 6. Test

- Appuyez sur "Se connecter avec Google"
- Vous devriez voir l'écran de connexion Google
- Après authentification, vous êtes connecté à l'app

## 🔐 Sécurité en Production

- Ne commitez JAMAIS vos clés Google dans Git
- Utilisez des variables d'environnement
- Validez TOUJOURS le token côté backend
- Utilisez HTTPS pour les appels API

## 📚 Ressources

- [Expo Auth Session Documentation](https://docs.expo.dev/guides/authentication/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [React Native Google Sign In](https://github.com/react-native-google-signin/google-signin)

## ✅ Fonctionnalités Disponibles

- ✅ Connexion avec Google/Gmail
- ✅ Inscription avec Google
- ✅ Connexion classique (email/password)
- ✅ Inscription classique
- ✅ Mode visiteur
- ✅ Affichage du type d'authentification utilisée
