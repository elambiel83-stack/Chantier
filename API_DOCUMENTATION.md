# API Documentation - Chantier Marketplace

## Base URL
```
http://localhost:5000/api
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### Authentication

#### Register
```http
POST /auth/register
```

**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "role": "buyer",
  "phone": "+1234567890",
  "company": {
    "name": "Construction Corp",
    "registrationNumber": "12345",
    "taxId": "TAX123"
  }
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "buyer"
  }
}
```

#### Login
```http
POST /auth/login
```

**Body:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "buyer"
  }
}
```

#### Get Profile
```http
GET /auth/profile
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "buyer",
    "phone": "+1234567890",
    "address": {...},
    "rating": {...}
  }
}
```

---

### Products

#### List Products
```http
GET /products?category=cement&minPrice=100&maxPrice=1000&search=concrete&page=1&limit=20
```

**Query Parameters:**
- `category` (optional): Filter by category
- `minPrice` (optional): Minimum price
- `maxPrice` (optional): Maximum price
- `search` (optional): Search in name and description
- `seller` (optional): Filter by seller ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)
- `sortBy` (optional): Sort field (default: createdAt)
- `order` (optional): Sort order: asc/desc (default: desc)

**Response:**
```json
{
  "products": [
    {
      "_id": "product_id",
      "name": "Premium Cement",
      "description": "High quality cement for construction",
      "category": "cement",
      "price": {
        "amount": 50,
        "currency": "USD",
        "unit": "bag"
      },
      "seller": {
        "name": "Seller Name",
        "company": {...},
        "rating": {...}
      },
      "stock": {
        "quantity": 1000,
        "unit": "bag"
      },
      "rating": {
        "average": 4.5,
        "count": 120
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### Get Product
```http
GET /products/:id
```

**Response:**
```json
{
  "product": {
    "_id": "product_id",
    "name": "Premium Cement",
    "description": "High quality cement...",
    "category": "cement",
    "price": {...},
    "seller": {...},
    "stock": {...},
    "specifications": {
      "brand": "CementCo",
      "model": "PC500",
      "weight": 50,
      "dimensions": {...}
    },
    "images": [...],
    "location": {...},
    "shipping": {...},
    "rating": {...},
    "views": 1523
  }
}
```

#### Create Product
```http
POST /products
```

**Body:**
```json
{
  "name": "Premium Cement",
  "description": "High quality cement for construction",
  "category": "cement",
  "price": {
    "amount": 50,
    "currency": "USD",
    "unit": "bag"
  },
  "seller": "seller_id",
  "stock": {
    "quantity": 1000,
    "unit": "bag"
  },
  "specifications": {
    "brand": "CementCo",
    "model": "PC500",
    "weight": 50
  },
  "location": {
    "city": "Paris",
    "country": "France"
  }
}
```

#### Update Product
```http
PUT /products/:id
```

#### Delete Product (Soft Delete)
```http
DELETE /products/:id
```

---

### Orders

#### List Orders
```http
GET /orders?buyer=buyer_id&seller=seller_id&status=pending&page=1&limit=20
```

**Query Parameters:**
- `buyer` (optional): Filter by buyer ID
- `seller` (optional): Filter by seller ID
- `status` (optional): Filter by status
- `page` (optional): Page number
- `limit` (optional): Results per page

#### Get Order
```http
GET /orders/:id
```

#### Create Order
```http
POST /orders
```

**Body:**
```json
{
  "buyer": "buyer_id",
  "items": [
    {
      "product": "product_id",
      "quantity": 10,
      "price": 50,
      "unit": "bag",
      "seller": "seller_id"
    }
  ],
  "totalAmount": {
    "subtotal": 500,
    "shipping": 50,
    "tax": 55,
    "total": 605,
    "currency": "USD"
  },
  "shippingAddress": {
    "name": "John Doe",
    "phone": "+1234567890",
    "street": "123 Main St",
    "city": "Paris",
    "country": "France",
    "postalCode": "75001"
  },
  "payment": {
    "method": "credit_card"
  }
}
```

#### Update Order Status
```http
PATCH /orders/:id/status
```

**Body:**
```json
{
  "status": "confirmed",
  "note": "Order confirmed and processing"
}
```

#### Cancel Order
```http
POST /orders/:id/cancel
```

**Body:**
```json
{
  "reason": "Customer request"
}
```

---

### Transport

#### List Transports
```http
GET /transport?transporter=id&status=in_transit&order=order_id
```

#### Get Transport
```http
GET /transport/:id
```

#### Create Transport
```http
POST /transport
```

**Body:**
```json
{
  "order": "order_id",
  "transporter": "transporter_id",
  "type": "standard",
  "vehicle": {
    "type": "truck",
    "plateNumber": "ABC123"
  },
  "pickup": {
    "location": {
      "city": "Paris",
      "country": "France"
    },
    "scheduledDate": "2024-01-20T10:00:00Z"
  },
  "delivery": {
    "location": {
      "city": "Lyon",
      "country": "France"
    },
    "scheduledDate": "2024-01-22T15:00:00Z"
  },
  "cost": {
    "amount": 150,
    "currency": "USD"
  }
}
```

#### Update Transport Status
```http
PATCH /transport/:id/status
```

**Body:**
```json
{
  "status": "in_transit",
  "location": {
    "latitude": 48.8566,
    "longitude": 2.3522,
    "address": "Current location"
  }
}
```

#### Update Tracking
```http
POST /transport/:id/tracking
```

**Body:**
```json
{
  "latitude": 48.8566,
  "longitude": 2.3522,
  "address": "Near destination"
}
```

---

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Error Response Format

```json
{
  "error": "Error message",
  "details": "Additional error details (in development mode)"
}
```
