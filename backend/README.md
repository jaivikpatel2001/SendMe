# SendMe Logistics Backend API

A comprehensive multi-role logistics and delivery booking platform backend built with Node.js, Express, and MongoDB. This production-ready API provides a complete foundation for building modern logistics and delivery applications.

## 🚀 Features

### Core Functionality
- **Multi-role Authentication**: Customer, Driver, and Admin roles with JWT-based authentication
- **Real-time Booking System**: Live tracking and status updates using Socket.IO
- **Dynamic Pricing**: Distance-based fare calculation with peak hour multipliers
- **Payment Integration**: Stripe payment processing with multiple payment methods
- **Notification System**: Email, SMS, and push notifications
- **Review & Rating System**: Comprehensive review system for drivers and customers
- **Promo Code Management**: Flexible discount and promotional code system
- **Support Ticketing**: Built-in customer support system
- **CMS Integration**: Dynamic content management for app content
- **Geolocation Services**: Google Maps integration for routing and distance calculation
- **File Upload**: Cloudinary integration for images and documents

### Technical Features
- **RESTful API**: Well-structured REST endpoints with proper HTTP status codes
- **Real-time Communication**: Socket.IO for live updates and chat
- **Rate Limiting**: Comprehensive rate limiting for security
- **Input Validation**: Joi-based request validation
- **Error Handling**: Centralized error handling with detailed logging
- **Database Optimization**: Indexed MongoDB collections for performance
- **Security**: Helmet, CORS, input sanitization, and XSS protection
- **Scalable Architecture**: Modular design with separation of concerns
- **Environment Configuration**: Flexible configuration for different deployment stages

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Real-time**: Socket.IO
- **Validation**: Joi
- **File Upload**: Multer + Cloudinary
- **Email**: Nodemailer
- **SMS**: Twilio
- **Push Notifications**: Firebase Admin SDK
- **Payments**: Stripe
- **Maps**: Google Maps API
- **Logging**: Winston
- **Testing**: Jest + Supertest

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   │   ├── database.js  # MongoDB connection
│   │   └── cloudinary.js # Cloudinary setup
│   ├── controllers/     # Route controllers
│   │   ├── authController.js
│   │   ├── customerController.js
│   │   ├── driverController.js
│   │   ├── adminController.js
│   │   └── publicController.js
│   ├── middleware/      # Custom middleware
│   │   ├── auth.js      # Authentication middleware
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   └── validation.js
│   ├── models/          # Mongoose models
│   │   ├── User.js
│   │   ├── Booking.js
│   │   ├── Vehicle.js
│   │   ├── Review.js
│   │   ├── PromoCode.js
│   │   ├── Notification.js
│   │   ├── SupportTicket.js
│   │   └── CmsContent.js
│   ├── routes/          # API routes
│   │   ├── auth.js
│   │   ├── customer.js
│   │   ├── driver.js
│   │   ├── admin.js
│   │   └── public.js
│   ├── utils/           # Utility functions
│   │   ├── jwt.js
│   │   ├── logger.js
│   │   ├── email.js
│   │   ├── sms.js
│   │   ├── pricing.js
│   │   └── distance.js
│   ├── seeders/         # Database seeders
│   │   ├── index.js
│   │   ├── vehicleTypes.js
│   │   └── adminUser.js
│   └── app.js           # Express app setup
├── uploads/             # Local file uploads
├── logs/                # Application logs
├── server.js            # Server entry point
├── package.json
└── README.md
```

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18.0.0 or higher)
- **npm** (v8.0.0 or higher)
- **MongoDB** (v5.0 or higher) - Local installation or MongoDB Atlas
- **Git** for version control

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd sendme-logistics/backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
```

Edit the `.env` file with your configuration values. See [Environment Variables](#environment-variables) section for details.

### 4. Database Setup

#### Option A: Local MongoDB
```bash
# Install MongoDB locally
# macOS
brew install mongodb-community

# Ubuntu
sudo apt-get install mongodb

# Start MongoDB service
mongod
```

#### Option B: MongoDB Atlas (Recommended for production)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get connection string and update `MONGODB_URI` in `.env`

### 5. Seed the Database
```bash
# Seed basic data (vehicle types, admin user)
npm run seed

# Seed development data (includes sample users and bookings)
npm run seed:dev

# Clear all data (use with caution)
npm run seed:clear
```

### 6. Start the Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

## ⚙️ Environment Variables

The application uses environment variables for configuration. Copy `.env.example` to `.env` and update the values:

### Core Configuration
```env
NODE_ENV=development                    # Environment: development, production, test
PORT=5000                              # Server port
MONGODB_URI=mongodb://localhost:27017/sendme-logistics  # Database connection
```

### Authentication & Security
```env
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-complex
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-here
JWT_EXPIRE=24h                         # Access token expiration
JWT_REFRESH_EXPIRE=7d                  # Refresh token expiration
BCRYPT_SALT_ROUNDS=12                  # Password hashing rounds
```

### Rate Limiting
```env
RATE_LIMIT_WINDOW_MS=900000           # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100           # Max requests per window
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5       # Max login attempts
OTP_RATE_LIMIT_MAX_ATTEMPTS=3         # Max OTP requests
```

### Email Configuration (SMTP)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password           # Use app-specific password for Gmail
FROM_NAME=SendMe Logistics
FROM_EMAIL=noreply@sendmelogistics.com
```

### SMS Configuration (Twilio)
```env
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
SMS_PROVIDER=twilio
MOCK_SMS_ENABLED=true                 # Set to false in production
```

### Google Maps API
```env
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Payment Processing (Stripe)
```env
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret
```

### File Upload (Cloudinary)
```env
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

### Push Notifications (Firebase)
```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-firebase-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### Optional Services
```env
REDIS_URL=redis://localhost:6379      # For caching (optional)
SENTRY_DSN=your-sentry-dsn            # For error monitoring (optional)
```

### Development Settings
```env
DEBUG_MODE=true
MOCK_PAYMENTS=true                    # Mock payments in development
MOCK_NOTIFICATIONS=true               # Mock notifications in development
LOG_LEVEL=info                        # Logging level: error, warn, info, debug
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Database Operations
```bash
# Seed basic data
npm run seed

# Seed development data (includes sample users)
npm run seed:dev

# Clear all data
npm run seed:clear
```

### Testing
```bash
npm test
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## 🧪 API Testing

### Quick Start Testing
1. **Start the server**: `npm run dev`
2. **Check health**: `GET http://localhost:5000/health`
3. **View API info**: `GET http://localhost:5000/api`

### Using Postman Collection
We provide a comprehensive Postman collection for testing all API endpoints:

1. **Import Collection**:
   - Import `postman/SendMe-Logistics-API.postman_collection.json`
   - Import `postman/SendMe-Logistics-Environment.postman_environment.json`

2. **Set Environment**:
   - Select "SendMe Logistics Environment"
   - Update `base_url` if needed (default: `http://localhost:5000`)

3. **Test Authentication**:
   ```bash
   # Login with default admin credentials
   POST /api/auth/login
   {
     "email": "admin@sendmelogistics.com",
     "password": "Admin@123456"
   }
   ```

4. **Auto-token Management**:
   - The collection automatically saves tokens from login responses
   - Tokens are used in subsequent authenticated requests

### Manual Testing with cURL

#### Health Check
```bash
curl -X GET http://localhost:5000/health
```

#### Register Customer
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "password": "Password@123",
    "role": "customer"
  }'
```

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@sendmelogistics.com",
    "password": "Admin@123456"
  }'
```

## 📚 API Documentation

### Base URL
- **Development**: `http://localhost:5000`
- **Production**: `https://your-domain.com`

### Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-access-token>
```

### Response Format
All API responses follow this structure:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  },
  "pagination": {  // Only for paginated responses
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error information"
  }
}
```

### Endpoint Categories

#### 🔐 Authentication Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | User registration | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/otp-request` | Request OTP | No |
| POST | `/api/auth/otp-verify` | Verify OTP | No |
| POST | `/api/auth/refresh-token` | Refresh access token | No |
| POST | `/api/auth/logout` | User logout | Yes |
| GET | `/api/auth/me` | Get current user | Yes |

#### 🌐 Public Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/public/home` | Home page data | No |
| GET | `/api/public/vehicle-types` | Available vehicles | No |
| GET | `/api/public/service-areas` | Service coverage | No |
| GET | `/api/public/faqs` | FAQ data | No |
| GET | `/api/public/driver-info` | Driver information | No |
| POST | `/api/public/contact` | Contact support | No |

#### 👤 Customer Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/customer/dashboard` | Customer dashboard | Yes (Customer) |
| POST | `/api/customer/bookings` | Create booking | Yes (Customer) |
| GET | `/api/customer/bookings/:id` | Get booking details | Yes (Customer) |
| GET | `/api/customer/bookings-history` | Booking history | Yes (Customer) |
| PUT | `/api/customer/bookings/:id/rebook` | Rebook order | Yes (Customer) |
| GET | `/api/customer/live-tracking/:id` | Live tracking | Yes (Customer) |
| POST | `/api/customer/reviews` | Submit review | Yes (Customer) |
| GET | `/api/customer/notifications` | Get notifications | Yes (Customer) |
| PUT | `/api/customer/notifications/:id/read` | Mark notification read | Yes (Customer) |
| PUT | `/api/customer/profile` | Update profile | Yes (Customer) |
| PUT | `/api/customer/payment-methods` | Update payment methods | Yes (Customer) |
| POST | `/api/customer/support` | Create support ticket | Yes (Customer) |
| GET | `/api/customer/faqs` | Customer FAQs | Yes (Customer) |

#### 🚗 Driver Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/driver/register` | Driver registration | No |
| GET | `/api/driver/dashboard` | Driver dashboard | Yes (Driver) |
| PUT | `/api/driver/status` | Toggle online/offline | Yes (Driver) |
| GET | `/api/driver/job-requests` | Available jobs | Yes (Driver) |
| PUT | `/api/driver/job-requests/:id/accept` | Accept job | Yes (Driver) |
| PUT | `/api/driver/job-requests/:id/reject` | Reject job | Yes (Driver) |
| PUT | `/api/driver/trips/:id/status` | Update trip status | Yes (Driver) |
| GET | `/api/driver/earnings` | Earnings data | Yes (Driver) |
| GET | `/api/driver/payouts` | Payout history | Yes (Driver) |
| POST | `/api/driver/payouts` | Request payout | Yes (Driver) |

#### 👨‍💼 Admin Endpoints
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/admin/dashboard` | Admin dashboard | Yes (Admin) |
| GET | `/api/admin/users` | User management | Yes (Admin) |
| PUT | `/api/admin/users/:id/status` | Update user status | Yes (Admin) |
| GET | `/api/admin/bookings` | Booking management | Yes (Admin) |
| GET | `/api/admin/bookings/:id` | Booking details | Yes (Admin) |
| POST | `/api/admin/promo-codes` | Create promo codes | Yes (Admin) |
| GET | `/api/admin/promo-codes` | Get promo codes | Yes (Admin) |
| PUT | `/api/admin/promo-codes/:id` | Update promo code | Yes (Admin) |
| GET | `/api/admin/support-tickets` | Support tickets | Yes (Admin) |
| PUT | `/api/admin/support-tickets/:id/assign` | Assign ticket | Yes (Admin) |
| GET | `/api/admin/analytics` | Platform analytics | Yes (Admin) |
| GET | `/api/admin/system-health` | System health | Yes (Admin) |

## Real-time Features

The application uses Socket.IO for real-time communication:

### Events
- `booking-update` - Booking status changes
- `driver-location` - Driver location updates
- `new-message` - Chat messages
- `driver-status-change` - Driver online/offline status

### Rooms
- `user-{userId}` - User-specific notifications
- `booking-{bookingId}` - Booking-specific updates
- `admin-dashboard` - Admin real-time data

## Security Features

- **Authentication**: JWT-based with refresh tokens
- **Rate Limiting**: Multiple rate limiters for different endpoints
- **Input Validation**: Joi schema validation
- **Data Sanitization**: MongoDB injection and XSS protection
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers
- **Password Hashing**: bcrypt with salt rounds

## Monitoring and Logging

- **Winston Logger**: Structured logging with different levels
- **Request Logging**: Morgan middleware for HTTP requests
- **Error Tracking**: Centralized error handling
- **Health Checks**: `/health` endpoint for monitoring

## 🚀 Deployment

### Production Environment Setup

#### 1. Environment Configuration
```bash
# Set production environment
NODE_ENV=production

# Use production database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sendme-logistics

# Configure external services
SMTP_HOST=your-production-smtp-host
TWILIO_ACCOUNT_SID=your-production-twilio-sid
STRIPE_SECRET_KEY=sk_live_your-production-stripe-key
GOOGLE_MAPS_API_KEY=your-production-maps-key

# Security settings
JWT_SECRET=your-super-secure-production-jwt-secret
BCRYPT_SALT_ROUNDS=12

# Disable development features
MOCK_PAYMENTS=false
MOCK_NOTIFICATIONS=false
DEBUG_MODE=false
```

#### 2. Database Setup
```bash
# Create production database indexes
npm run seed  # Only run once for initial setup
```

#### 3. SSL Certificate Setup
```bash
# Using Let's Encrypt with Certbot
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### Docker Deployment

#### Dockerfile
```dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Bundle app source
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/sendme-logistics
    depends_on:
      - mongo
      - redis
    restart: unless-stopped
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  mongo_data:
```

### Cloud Deployment Options

#### 1. Heroku
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create sendme-logistics-api

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your-mongodb-atlas-uri
heroku config:set JWT_SECRET=your-jwt-secret

# Deploy
git push heroku main
```

#### 2. AWS EC2
```bash
# Connect to EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Node.js and PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# Clone and setup application
git clone your-repo
cd sendme-logistics/backend
npm install --production

# Start with PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

#### 3. DigitalOcean App Platform
```yaml
# .do/app.yaml
name: sendme-logistics-api
services:
- name: api
  source_dir: /backend
  github:
    repo: your-username/sendme-logistics
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: MONGODB_URI
    value: ${DATABASE_URL}
  - key: JWT_SECRET
    value: ${JWT_SECRET}
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO support
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'sendme-logistics-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=1024'
  }]
};
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run linting and tests
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Email: support@sendmelogistics.com
- Documentation: [API Docs](http://localhost:5000/api)
- Issues: GitHub Issues
