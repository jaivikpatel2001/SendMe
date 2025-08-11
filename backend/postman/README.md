# SendMe Logistics API - Postman Collection

This directory contains a comprehensive Postman collection for testing the SendMe Logistics API. The collection includes all endpoints with automatic token management and test scripts.

## 📁 Files

- `SendMe_Logistics_Complete_API.postman_collection.json` - Complete API collection with integrated variables

## 🚀 Quick Setup

### 1. Import Collection
1. Open Postman
2. Click "Import" button
3. Select `SendMe_Logistics_Complete_API.postman_collection.json`
4. The collection will be imported with all variables included

### 2. Start the Server
```bash
cd backend
npm run dev
```
Server will start at `http://localhost:5000`

### 3. Test the API
1. **Health Check**: Run the "Health Check" request to verify server is running
2. **Login**: Use the "Login" request with default admin credentials
3. **Explore**: All other endpoints will use the automatically saved tokens

## 🔐 Default Test Accounts

After running `npm run seed:dev`, you can use these accounts:

### Admin Account
```
Email: admin@sendmelogistics.com
Password: Admin@123456
```

### Customer Account
```
Email: john.doe@example.com
Password: Customer@123
```

### Driver Account
```
Email: mike.johnson@example.com
Password: Driver@123
```

## 📋 Collection Structure

### Health & Info
- **Health Check** - Verify server status
- **API Info** - Get API information and available endpoints

### Authentication
- **Register Customer** - Create new customer account
- **Register Driver** - Create new driver account (requires approval)
- **Login** - Authenticate user and get tokens
- **Request OTP** - Request SMS verification code
- **Verify OTP** - Verify SMS code
- **Refresh Token** - Get new access token
- **Get Current User** - Get authenticated user details
- **Logout** - Invalidate tokens

### Public Endpoints
- **Get Home Data** - Public homepage information
- **Get Vehicle Types** - Available vehicle types and pricing
- **Get Service Areas** - Service coverage areas
- **Get FAQs** - Frequently asked questions
- **Get Driver Info** - Information for potential drivers
- **Contact Support** - Submit contact form

### Customer Endpoints
- **Get Dashboard** - Customer dashboard with stats
- **Create Booking** - Create new delivery booking
- **Get Booking Details** - Get specific booking information
- **Get Booking History** - List past bookings with filters
- **Get Live Tracking** - Real-time tracking for active bookings
- **Submit Review** - Rate and review completed bookings
- **Get Notifications** - User notifications
- **Update Profile** - Update customer profile
- **Update Payment Methods** - Manage payment methods

### Driver Endpoints
- **Get Driver Dashboard** - Driver dashboard with earnings and jobs
- **Toggle Online Status** - Set driver availability
- **Get Job Requests** - Available delivery jobs nearby
- **Accept Job Request** - Accept a delivery job
- **Update Trip Status** - Update delivery status
- **Get Earnings** - View earnings data and analytics

### Admin Endpoints
- **Get Admin Dashboard** - Platform statistics and overview
- **Get All Users** - User management with filters
- **Update User Status** - Approve/reject/suspend users
- **Get All Bookings** - Booking management and oversight
- **Create Promo Code** - Create promotional codes
- **Get Analytics** - Platform analytics and reports

## 🔧 Automatic Features

### Token Management
- **Auto-save**: Login responses automatically save access and refresh tokens
- **Auto-use**: All authenticated requests automatically use saved tokens
- **Auto-refresh**: Collection can be extended to auto-refresh expired tokens

### Variable Management
- **serverUrl**: Server URL (default: http://localhost:5000)
- **baseUrl**: API base (defaults to {{serverUrl}}/api)
- **access_token**: JWT access token (auto-populated)
- **refresh_token**: JWT refresh token (auto-populated)
- **user_id**: Current user ID (auto-populated)
- **user_role**: Current user role (auto-populated)
- **booking_id**: Created booking ID (auto-populated)

### Test Scripts
- **Global tests**: Every request includes response time and structure validation
- **Specific tests**: Individual endpoints have custom validation
- **Console logging**: Detailed logs for debugging and monitoring

## 🧪 Testing Workflows

### Basic API Test
1. Health Check
2. API Info
3. Login with admin credentials
4. Get Current User

### Customer Workflow
1. Register Customer (or login with existing)
2. Get Dashboard
3. Get Vehicle Types (from Public endpoints)
4. Create Booking
5. Get Booking Details
6. Get Live Tracking

### Driver Workflow
1. Register Driver (or login with existing)
2. Get Driver Dashboard
3. Toggle Online Status
4. Get Job Requests
5. Accept Job Request
6. Update Trip Status

### Admin Workflow
1. Login with admin credentials
2. Get Admin Dashboard
3. Get All Users
4. Update User Status (approve drivers)
5. Get All Bookings
6. Create Promo Code
7. Get Analytics

## 💡 Tips and Best Practices

### Using Variables
- Variables are automatically managed, but you can manually set them if needed
- Use `{{variable_name}}` syntax in requests
- Check the Variables tab to see current values

### Testing Different Roles
1. Login with different account types to test role-based access
2. Use the saved `user_role` variable to verify correct permissions
3. Test unauthorized access by using wrong role credentials

### Debugging
- Check the Console tab for detailed request/response logs
- Use the Test Results tab to see validation outcomes
- Enable Postman Console for even more detailed logging

### Environment Setup
- The collection works with default localhost setup
- Update `base_url` variable for different environments
- All other variables are automatically managed

## 🔍 Troubleshooting

### Common Issues

**Server not responding**
- Ensure backend server is running: `npm run dev`
- Check if port 5000 is available
- Verify `base_url` variable is correct

**Authentication errors**
- Run the Login request to get fresh tokens
- Check if user account exists (run seeders if needed)
- Verify credentials are correct

**Permission denied**
- Ensure you're logged in with the correct role
- Admin endpoints require admin account
- Driver endpoints require driver account

**Variables not saving**
- Check if test scripts are enabled
- Verify response format matches expected structure
- Look for errors in Console tab

### Getting Help
- Check server logs for backend errors
- Use Postman Console for detailed request debugging
- Verify database is seeded with test data

## 📚 Additional Resources

- [Backend README](../README.md) - Complete backend documentation
- [API Root](http://localhost:5000/api) - API root listing endpoints
- [Health](http://localhost:5000/health) - Health check
- [Postman Documentation](https://learning.postman.com/) - Learn more about Postman features
