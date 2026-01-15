# Quick Start Guide - Chantier Marketplace

Get your Chantier construction materials marketplace up and running in minutes!

## Prerequisites

Ensure you have the following installed:
- **Node.js** v16 or higher ([Download](https://nodejs.org/))
- **MongoDB** ([Download](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
- **npm** or **yarn** (comes with Node.js)

For mobile development:
- **React Native CLI** ([Setup Guide](https://reactnative.dev/docs/environment-setup))
- **Android Studio** (for Android) or **Xcode** (for iOS)

## 🚀 Quick Start - Development Mode

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/elambiel83-stack/Chantier.git
cd Chantier

# Install all dependencies (backend, web, mobile)
npm run install-all
```

### 2. Setup Environment

```bash
# Copy environment example
cp .env.example .env

# Edit .env with your configurations
# Minimum required: MONGODB_URI and JWT_SECRET
```

### 3. Start Backend API

```bash
# Start the API server
npm run dev

# API will be available at: http://localhost:5000
```

### 4. Start Web Application (in a new terminal)

```bash
# Start the web app
npm run web

# Web app will open at: http://localhost:3000
```

### 5. Start Mobile App (optional, in a new terminal)

```bash
# Start Metro bundler
npm run mobile

# In another terminal, run on Android or iOS
cd mobile
npx react-native run-android
# or
npx react-native run-ios
```

## 📱 Test the Application

### Web Application

1. Open http://localhost:3000
2. Browse products or register a new account
3. Try creating an order as a buyer
4. Switch to seller role to add products

### API Testing

Test the API with curl or Postman:

```bash
# Health check
curl http://localhost:5000/api/health

# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "role": "buyer"
  }'

# Get products
curl http://localhost:5000/api/products
```

## 🗄️ Database Setup

### Option 1: Local MongoDB

```bash
# Start MongoDB service
sudo systemctl start mongodb

# Your connection string in .env:
MONGODB_URI=mongodb://localhost:27017/chantier
```

### Option 2: MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster
3. Get your connection string
4. Update `.env` with your connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chantier
```

## 🎨 Sample Data (Optional)

To populate the database with sample data for testing:

```bash
# This will create sample users, products, and orders
node backend/scripts/seed.js
```

(Note: You'll need to create this seed script if needed)

## 🔧 Common Issues & Solutions

### Issue: "Cannot connect to MongoDB"
**Solution:** 
- Ensure MongoDB is running: `sudo systemctl status mongodb`
- Check your MONGODB_URI in `.env`
- If using Atlas, verify your IP is whitelisted

### Issue: "Port already in use"
**Solution:** 
- Backend: Change PORT in `.env` (default: 5000)
- Web: React will ask to use a different port automatically
- Or kill the process using the port:
  ```bash
  # Find and kill process on port 5000
  lsof -ti:5000 | xargs kill -9
  ```

### Issue: "Module not found"
**Solution:** 
```bash
# Reinstall dependencies
rm -rf node_modules web/node_modules mobile/node_modules
npm run install-all
```

### Issue: Mobile app won't build
**Solution:** 
```bash
# Clean and rebuild
cd mobile/android
./gradlew clean

# For iOS
cd mobile/ios
pod install
```

## 📚 Next Steps

1. **Read the Documentation**
   - Full README: `README.md`
   - API Documentation: `API_DOCUMENTATION.md`
   - Deployment Guide: `DEPLOYMENT.md`

2. **Customize the Platform**
   - Add your branding
   - Configure payment gateway
   - Add analytics tracking
   - Customize email templates

3. **Deploy to Production**
   - Follow the deployment guide
   - Set up SSL certificates
   - Configure production database
   - Enable monitoring

## 🆘 Getting Help

- **Issues**: Open an issue on [GitHub](https://github.com/elambiel83-stack/Chantier/issues)
- **Documentation**: Check the docs in the repository
- **Community**: Join our community discussions

## ⚡ Development Tips

### Hot Reload

- **Backend**: Using nodemon, changes auto-reload
- **Web**: React hot reloading enabled by default
- **Mobile**: Metro bundler with fast refresh

### VS Code Extensions (Recommended)

- ESLint
- Prettier
- React Native Tools
- MongoDB for VS Code

### Useful Scripts

```bash
# Backend only
npm start              # Production mode
npm run dev           # Development mode with nodemon

# Web only
cd web && npm start   # Start web app
cd web && npm run build  # Build for production

# Mobile only
cd mobile && npm start  # Start Metro bundler
```

## 🎉 You're All Set!

Your Chantier marketplace is now running. Start building and customizing your construction materials platform!

---

**Happy Building! 🏗️**
