# Crochet ArtY - E-commerce Platform

## Quick Start Guide

### 1. Start Backend Server (Required)
The backend server **must** run on port 5000 for the frontend to work properly.

```bash
cd backend
npm install
npm run dev
```

The server will start on: `http://localhost:5000`

### 2. Start Frontend Server
```bash
cd frontend
python -m http.server 8000
# OR
npx http-server -p 8000
```

The frontend will be available at: `http://localhost:8000`

### 3. Check Backend Connection
To verify the backend is running correctly:

```bash
node check-backend.js
```

## Important Notes

- **Backend Port**: The backend is configured to run on port 5000 only
- **Frontend Configuration**: The frontend is configured to connect to `http://localhost:5000/api`
- **No Port Switching**: The system no longer tries multiple ports - it uses port 5000 exclusively

## Troubleshooting

### Backend Not Starting on Port 5000
If you get "Port 5000 is already in use":

1. **Find what's using port 5000:**
   ```bash
   # Windows
   netstat -ano | findstr :5000
   
   # Mac/Linux
   lsof -i :5000
   ```

2. **Kill the process or change the port:**
   - Kill the process using the port, OR
   - Change the PORT in `backend/config.env` to another port (e.g., 5001)
   - Update the frontend API URL in `frontend/js/api.js` to match

### Frontend Can't Connect to Backend
1. Ensure backend is running: `node check-backend.js`
2. Check browser console for connection errors
3. Verify no firewall is blocking port 5000

## Default Login Credentials

After running the seed script:

- **Customer**: customer@example.com / password123
- **Artisan**: artisan@example.com / password123
- **Admin**: admin@example.com / password123

## Features

- ✅ User Authentication & Authorization
- ✅ Product Browsing & Search
- ✅ Shopping Cart Management
- ✅ Wishlist Functionality
- ✅ Order Management & Tracking
- ✅ Reviews & Ratings System
- ✅ Artisan Dashboard & Analytics
- ✅ Responsive Design
- ✅ Real-time Notifications