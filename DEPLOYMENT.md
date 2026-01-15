# Deployment Guide - Chantier Marketplace

## Table of Contents
1. [Backend Deployment](#backend-deployment)
2. [Web App Deployment](#web-app-deployment)
3. [Mobile App Deployment](#mobile-app-deployment)
4. [Database Setup](#database-setup)
5. [Environment Variables](#environment-variables)

---

## Backend Deployment

### Option 1: Heroku

1. **Install Heroku CLI**
```bash
npm install -g heroku
```

2. **Login to Heroku**
```bash
heroku login
```

3. **Create Heroku App**
```bash
heroku create chantier-api
```

4. **Set Environment Variables**
```bash
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your_mongodb_connection_string
heroku config:set JWT_SECRET=your_jwt_secret
```

5. **Deploy**
```bash
git push heroku main
```

### Option 2: DigitalOcean / VPS

1. **Setup Node.js on Server**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Install PM2**
```bash
sudo npm install -g pm2
```

3. **Clone Repository**
```bash
git clone https://github.com/yourusername/Chantier.git
cd Chantier
npm install
```

4. **Setup Environment Variables**
```bash
nano .env
# Add your environment variables
```

5. **Start with PM2**
```bash
pm2 start backend/server.js --name chantier-api
pm2 save
pm2 startup
```

6. **Setup Nginx as Reverse Proxy**
```nginx
server {
    listen 80;
    server_name api.chantier.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Web App Deployment

### Option 1: Vercel

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Navigate to Web Directory**
```bash
cd web
```

3. **Deploy**
```bash
vercel
```

4. **Set Environment Variables in Vercel Dashboard**
- `REACT_APP_API_URL=https://api.chantier.com`

### Option 2: Netlify

1. **Build the App**
```bash
cd web
npm run build
```

2. **Deploy via Netlify CLI**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=build
```

3. **Set Environment Variables in Netlify Dashboard**

### Option 3: Manual Hosting (Nginx)

1. **Build the App**
```bash
cd web
npm run build
```

2. **Copy Build to Server**
```bash
scp -r build/ user@server:/var/www/chantier
```

3. **Configure Nginx**
```nginx
server {
    listen 80;
    server_name chantier.com www.chantier.com;
    root /var/www/chantier;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Mobile App Deployment

### Android (Google Play Store)

1. **Generate Keystore**
```bash
cd mobile/android/app
keytool -genkey -v -keystore chantier.keystore -alias chantier -keyalg RSA -keysize 2048 -validity 10000
```

2. **Configure Gradle**
Edit `mobile/android/app/build.gradle`:
```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('chantier.keystore')
            storePassword 'your_password'
            keyAlias 'chantier'
            keyPassword 'your_password'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

3. **Build Release APK/AAB**
```bash
cd mobile/android
./gradlew bundleRelease
# AAB file will be at: app/build/outputs/bundle/release/app-release.aab
```

4. **Upload to Google Play Console**
- Create app in Google Play Console
- Upload AAB file
- Fill in store listing details
- Submit for review

### iOS (Apple App Store)

1. **Configure Xcode Project**
```bash
cd mobile/ios
pod install
open Chantier.xcworkspace
```

2. **Set Signing & Capabilities in Xcode**
- Select your development team
- Configure bundle identifier
- Enable required capabilities

3. **Archive the App**
- Product > Archive in Xcode
- Distribute App > App Store Connect
- Upload to App Store Connect

4. **Submit for Review in App Store Connect**
- Fill in app information
- Add screenshots and descriptions
- Submit for review

---

## Database Setup

### MongoDB Atlas (Cloud)

1. **Create Account** at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

2. **Create Cluster**
- Choose free tier (M0) or paid plan
- Select region close to your users

3. **Create Database User**
- Database Access > Add New Database User
- Set username and password

4. **Whitelist IP Addresses**
- Network Access > Add IP Address
- Add 0.0.0.0/0 for all IPs (or specific IPs for security)

5. **Get Connection String**
- Clusters > Connect > Connect your application
- Copy connection string
- Replace `<password>` with your database user password

### Local MongoDB

```bash
# Install MongoDB
sudo apt-get install -y mongodb

# Start MongoDB service
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Connection string
mongodb://localhost:27017/chantier
```

---

## Environment Variables

### Backend (.env)
```env
# Server
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chantier

# JWT
JWT_SECRET=your_very_secure_random_string_here

# Optional: Payment & Maps
STRIPE_SECRET_KEY=sk_live_xxxxx
GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXX

# URLs
WEB_URL=https://chantier.com
```

### Web (.env.local)
```env
REACT_APP_API_URL=https://api.chantier.com
```

### Mobile
Update `mobile/src/services/api.js`:
```javascript
const API_URL = 'https://api.chantier.com/api';
```

---

## Security Checklist

- [ ] Use HTTPS for all services
- [ ] Set strong JWT secret
- [ ] Enable CORS only for your domains
- [ ] Use environment variables for secrets
- [ ] Set up database backups
- [ ] Implement rate limiting
- [ ] Enable security headers
- [ ] Keep dependencies updated
- [ ] Use prepared statements for database queries
- [ ] Implement proper error handling (don't leak sensitive info)

---

## Monitoring & Maintenance

### Recommended Tools
- **Error Tracking**: Sentry
- **Performance Monitoring**: New Relic, Datadog
- **Uptime Monitoring**: UptimeRobot
- **Analytics**: Google Analytics, Mixpanel

### Regular Tasks
- Monitor server resources (CPU, RAM, disk)
- Review error logs
- Update dependencies regularly
- Backup database
- Test recovery procedures
- Monitor API response times
- Check for security vulnerabilities

---

## Scaling Considerations

### Backend
- Use load balancer (Nginx, AWS ELB)
- Implement caching (Redis)
- Use CDN for static assets
- Horizontal scaling with multiple instances

### Database
- Enable database replication
- Use database indexes
- Implement connection pooling
- Consider database sharding for large scale

### Mobile
- Implement proper image caching
- Use lazy loading
- Optimize bundle size
- Implement offline mode

---

For support, please open an issue on GitHub or contact the development team.
