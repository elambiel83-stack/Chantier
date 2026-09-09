# Copilot Instructions for MonChantier

## Project Overview

MonChantier is a multi-platform e-commerce application for selling construction materials and services online in French-speaking markets. The project consists of three main components:

- **Backend**: Node.js/Express REST API
- **Mobile**: React Native/Expo mobile application
- **Web**: Progressive Web App (PWA) with vanilla JavaScript

## Technology Stack

### Backend (`/backend`)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Key Dependencies**: 
  - `express` - Web framework
  - `cors` - CORS middleware
  - `dotenv` - Environment configuration
- **API Documentation**: OpenAPI 3.0 specification in `openapi.yaml`
- **Database Schema**: PostgreSQL schema in `schema.sql`

### Mobile (`/mobile`)
- **Framework**: React Native with Expo (~54.0.0)
- **React Version**: 19.1.0
- **Navigation**: React Navigation (native stack)
- **Authentication**: Expo Auth Session for OAuth
- **Key Features**: Google authentication setup

### Web (`/web`)
- **Type**: Progressive Web App (PWA)
- **Stack**: Vanilla JavaScript (no framework)
- **Features**: Service Worker, Web App Manifest
- **Server**: Python HTTP server for local development

## Language & Localization

- **Primary Language**: French
- **Secondary Language**: English
- **Format**: The application supports bilingual content (French/English)
- All user-facing strings should be provided in both `name_fr` and `name_en` formats
- Database fields and API responses include both language variants

## Code Style Guidelines

### General
- Use clear, descriptive variable names in English for code
- User-facing content should be in French (primary) and English (secondary)
- Follow existing patterns in the codebase
- Keep code modular and maintainable

### Backend
- Use `const` for immutable values, `let` for variables
- Use async/await for asynchronous operations
- Follow REST API conventions
- Use meaningful HTTP status codes (200, 201, 400, 404, 500, etc.)
- Include proper error handling with try-catch blocks
- Validate input data before processing

### Mobile (React Native)
- Use functional components with hooks
- Follow React Native best practices
- Use meaningful component names
- Keep components small and focused
- Use React Navigation for navigation
- Handle loading and error states appropriately

### Web (PWA)
- Use vanilla JavaScript (ES6+)
- Keep files modular
- Follow existing patterns for DOM manipulation
- Ensure PWA features work offline where possible
- Use service workers for caching strategies

## Database

### Schema
- **Products**: Construction materials with multilingual names, units, prices (USD)
- **Customers**: User information including contact details
- **Orders**: Order management with status tracking
- **Order Items**: Line items for orders

### Conventions
- Use UUIDs for primary keys (except products which use string IDs)
- Use snake_case for column names
- Price fields use `NUMERIC(10,2)` for precision
- Timestamps use `TIMESTAMPTZ` with default `now()`
- Order status values: `pending`, `confirmed`, `delivering`, `completed`, `cancelled`

## API Endpoints

- `GET /products` - List products with optional search query `q`
- `POST /orders` - Create a new order with customer and items
- `GET /health` or similar - Health check endpoint (add if needed)

## Development Workflow

### Backend
```bash
cd backend
npm install
npm run dev  # Development with nodemon
npm start    # Production
```

### Mobile
```bash
cd mobile
npm install
npm start    # Start Expo
npm run android  # Run on Android
npm run ios      # Run on iOS
```

### Web
```bash
cd web
npm start    # Python server on port 8080
```

## Best Practices

1. **Security**
   - Never commit sensitive data (API keys, passwords)
   - Use environment variables for configuration
   - Validate and sanitize all user inputs
   - Use CORS properly in the backend

2. **Error Handling**
   - Always include proper error handling
   - Return meaningful error messages
   - Log errors appropriately
   - Handle edge cases

3. **Testing**
   - Follow existing test patterns if tests exist
   - Test edge cases and error conditions
   - Ensure backward compatibility

4. **Documentation**
   - Update API documentation when adding endpoints
   - Comment complex logic
   - Keep README files up to date

5. **Performance**
   - Optimize database queries
   - Use appropriate caching strategies
   - Minimize bundle sizes for mobile/web

## Common Tasks

### Adding a New Product
- Add to the PRODUCTS array in `backend/server.js`
- Ensure both `name_fr` and `name_en` are provided
- Include appropriate `unit`, `price`, `img`, `category`, and `stock`

### Adding a New API Endpoint
- Add the route in `backend/server.js`
- Update `backend/openapi.yaml` with the new endpoint
- Ensure proper error handling and validation

### Adding a New Screen (Mobile)
- Create screen component in `mobile/screens/`
- Register in navigation configuration
- Follow existing screen patterns

### Modifying Database Schema
- Update `backend/schema.sql`
- Add migration scripts if needed
- Update corresponding API endpoints

## Environment Variables

### Backend
- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - Allowed CORS origin (default: *)
- Database connection strings as needed

## Notes for AI Assistants

- This is a learning/starter project for e-commerce in construction materials
- Focus on simplicity and clarity over complex abstractions
- Maintain consistency with existing code patterns
- The project serves French-speaking markets (Africa/France)
- Consider mobile-first design for UI changes
- Currency is in USD throughout the application
