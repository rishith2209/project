// API Service for Crochet ArtY Frontend-Backend Integration

// Fixed API configuration - backend runs on port 5000
const API_BASE_URL = 'https://backend-9ppr.onrender.com/api';

// Utility functions
const getAuthToken = () => localStorage.getItem('token');
const setAuthToken = (token) => localStorage.setItem('token', token);
const removeAuthToken = () => localStorage.removeItem('token');

// Test API connection
async function checkApiConnection() {
  console.log('🔍 Checking API server connection...');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10s
    
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API server connected successfully:', data.message);
      return true;
    } else if (response.status === 429) {
      console.warn('⚠️ Rate limited, but server is running');
      return true; // Server is running, just rate limited
    } else {
      console.error(`❌ API server responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ API connection timeout');
    } else {
      console.error('❌ Failed to connect to API server:', error.message);
    }
    return false;
  }
}

// API request helper with improved error handling and retry logic
async function apiRequest(endpoint, options = {}, retryCount = 0) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const maxRetries = 3;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    },
    mode: 'cors',
    credentials: 'include',
    ...options
  };

  try {
    console.log(`🌐 Making API request to: ${url}`);
    const response = await fetch(url, config);
    
    // Handle different response types
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { message: await response.text() };
    }
    
    console.log(`📡 API Response:`, data);
    
    // Handle different response statuses
    if (response.status === 401) {
      console.warn('🔐 Authentication failed, clearing tokens');
      removeAuthToken();
      localStorage.removeItem('user');
      
      // Don't automatically redirect - let user stay on current page
      // They can manually login when needed
      throw new Error('Authentication required');
    }
    
    // Handle rate limiting
    if (response.status === 429) {
      console.warn('⚠️ Rate limited, retrying in 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Don't throw error for rate limiting, let it retry
      throw new Error('Rate limited - please try again');
    }
    
    if (!response.ok) {
      throw new Error(data.message || `API request failed with status ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('❌ API Error:', error);
    
    // Handle network errors with retry logic
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('🌐 Network error - checking API connection');
      // Try to reconnect to API
      const reconnected = await checkApiConnection();
      if (!reconnected) {
        throw new Error('Backend server is not available. Please ensure the server is running on port 5000.');
      }
    }
    
    // Retry logic for transient errors
    if (retryCount < maxRetries && (
      error.message.includes('fetch') || 
      error.message.includes('network') ||
      error.message.includes('timeout')
    )) {
      console.log(`🔄 Retrying request (${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return apiRequest(endpoint, options, retryCount + 1);
    }
    
    throw error;
  }
}

// Authentication API
const authAPI = {
  // Register new user
  async register(userData) {
    console.log('📝 Registering user:', userData);
    return await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  // Login user
  async login(credentials) {
    console.log('🔐 Logging in user:', credentials.email);
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    
    if (response.success && response.data.token) {
      setAuthToken(response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      console.log('✅ Login successful');
    }
    
    return response;
  },

  // Logout user
  async logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      removeAuthToken();
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
  },

  // Get user profile
  async getProfile() {
    return await apiRequest('/auth/profile');
  },

  // Update user profile
  async updateProfile(profileData) {
    return await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },

  // Verify token
  async verifyToken() {
    try {
      const response = await apiRequest('/auth/verify');
      return response.success;
    } catch (error) {
      return false;
    }
  },

  // Refresh token
  async refreshToken() {
    try {
      const response = await apiRequest('/auth/refresh', {
        method: 'POST'
      });
      
      if (response.success && response.data.token) {
        setAuthToken(response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('✅ Token refreshed successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return false;
    }
  }
};

// Products API
const productsAPI = {
  // Get all products with filtering
  async getAllProducts(filters = {}) {
    const params = new URLSearchParams(filters);
    return await apiRequest(`/products?${params}`);
  },

  // Get single product
  async getProduct(id) {
    return await apiRequest(`/products/${id}`);
  },

  // Get featured products
  async getFeaturedProducts(limit = 8) {
    return await apiRequest(`/products/featured?limit=${limit}`);
  },

  // Get products by category
  async getProductsByCategory(category, filters = {}) {
    const params = new URLSearchParams(filters);
    return await apiRequest(`/products/category/${category}?${params}`);
  },

  // Search products
  async searchProducts(query, filters = {}) {
    const params = new URLSearchParams({ q: query, ...filters });
    return await apiRequest(`/products/search?${params}`);
  },

  // Create product (artisan only)
  async createProduct(productData) {
    return await apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(productData)
    });
  },

  // Update product (artisan only)
  async updateProduct(id, productData) {
    return await apiRequest(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData)
    });
  },

  // Delete product (artisan only)
  async deleteProduct(id) {
    return await apiRequest(`/products/${id}`, {
      method: 'DELETE'
    });
  }
};

// Cart API
const cartAPI = {
  // Get user's cart
  async getCart() {
    return await apiRequest('/cart');
  },

  // Get cart summary
  async getCartSummary() {
    return await apiRequest('/cart/summary');
  },

  // Add item to cart
  async addToCart(productId, quantity = 1) {
    return await apiRequest('/cart/add', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity })
    });
  },

  // Update cart item quantity
  async updateCartItem(productId, quantity) {
    return await apiRequest(`/cart/item/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity })
    });
  },

  // Remove item from cart
  async removeFromCart(productId) {
    return await apiRequest(`/cart/item/${productId}`, {
      method: 'DELETE'
    });
  },

  // Clear cart
  async clearCart() {
    return await apiRequest('/cart/clear', {
      method: 'DELETE'
    });
  },

  // Validate cart
  async validateCart() {
    return await apiRequest('/cart/validate');
  }
};

// Artisan Dashboard API
const artisanAPI = {
  // Get dashboard stats
  async getDashboardStats() {
    return await apiRequest('/artisan/dashboard/stats');
  },

  // Get artisan's products
  async getArtisanProducts(filters = {}) {
    const params = new URLSearchParams(filters);
    return await apiRequest(`/artisan/products?${params}`);
  },

  // Update product status
  async updateProductStatus(productId, isActive) {
    return await apiRequest(`/artisan/products/${productId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive })
    });
  },

  // Update product featured status
  async updateProductFeatured(productId, isFeatured) {
    return await apiRequest(`/artisan/products/${productId}/featured`, {
      method: 'PUT',
      body: JSON.stringify({ isFeatured })
    });
  },

  // Get artisan profile
  async getArtisanProfile() {
    return await apiRequest('/artisan/profile');
  },

  // Update artisan profile
  async updateArtisanProfile(profileData) {
    return await apiRequest('/artisan/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },

  // Get artisan analytics
  async getAnalytics(period = 30) {
    return await apiRequest(`/artisan/analytics?period=${period}`);
  }
};

// Orders API
const ordersAPI = {
  // Create new order
  async createOrder(orderData) {
    return await apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  // Get user's orders
  async getUserOrders(filters = {}) {
    const params = new URLSearchParams(filters);
    return await apiRequest(`/orders?${params}`);
  },

  // Get single order
  async getOrder(orderId) {
    return await apiRequest(`/orders/${orderId}`);
  },

  // Cancel order
  async cancelOrder(orderId) {
    return await apiRequest(`/orders/${orderId}/cancel`, {
      method: 'PUT'
    });
  },

  // Get artisan orders
  async getArtisanOrders(filters = {}) {
    const params = new URLSearchParams(filters);
    return await apiRequest(`/orders/artisan/orders?${params}`);
  },

  // Update order status
  async updateOrderStatus(orderId, statusData) {
    return await apiRequest(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData)
    });
  }
};

// UI Helper functions
const uiHelpers = {
  // Show loading spinner
  showLoading(element) {
    if (element) {
      element.innerHTML = '<div class="loading">Loading...</div>';
    }
  },

  // Show error message
  showError(message, element) {
    if (element) {
      element.innerHTML = `<div class="error">${message}</div>`;
    }
  },

  // Show success message
  showSuccess(message, element) {
    if (element) {
      element.innerHTML = `<div class="success">${message}</div>`;
    }
  },

  // Format price
  formatPrice(price) {
    return `₹${parseFloat(price).toFixed(2)}`;
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!getAuthToken();
  },

  // Check if user is artisan
  isArtisan() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'artisan' || user.role === 'admin';
  },

  // Check if authenticated (no automatic redirect)
  requireAuth() {
    if (!this.isAuthenticated()) {
      console.log('🔐 Authentication required - user can login manually');
      return false;
    }
    return true;
  },

  // Check if artisan (no automatic redirect)
  requireArtisan() {
    if (!this.isAuthenticated()) {
      console.log('🔐 Authentication required - user can login manually');
      return false;
    }
    if (!this.isArtisan()) {
      console.log('🔐 Artisan access required');
      return false;
    }
    return true;
  }
};

// Reviews API
const reviewsAPI = {
  // Create review
  async createReview(reviewData) {
    return await apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData)
    });
  },

  // Get product reviews
  async getProductReviews(productId, filters = {}) {
    const params = new URLSearchParams(filters);
    return await apiRequest(`/reviews/product/${productId}?${params}`);
  },

  // Get user reviews
  async getUserReviews(filters = {}) {
    const params = new URLSearchParams(filters);
    return await apiRequest(`/reviews/user?${params}`);
  },

  // Update review
  async updateReview(reviewId, reviewData) {
    return await apiRequest(`/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(reviewData)
    });
  },

  // Delete review
  async deleteReview(reviewId) {
    return await apiRequest(`/reviews/${reviewId}`, {
      method: 'DELETE'
    });
  },

  // Mark review as helpful
  async markHelpful(reviewId) {
    return await apiRequest(`/reviews/${reviewId}/helpful`, {
      method: 'POST'
    });
  }
};

// Wishlist API
const wishlistAPI = {
  // Get wishlist
  async getWishlist() {
    return await apiRequest('/wishlist');
  },

  // Add to wishlist
  async addToWishlist(productId) {
    return await apiRequest('/wishlist/add', {
      method: 'POST',
      body: JSON.stringify({ productId })
    });
  },

  // Remove from wishlist
  async removeFromWishlist(productId) {
    return await apiRequest(`/wishlist/remove/${productId}`, {
      method: 'DELETE'
    });
  },

  // Clear wishlist
  async clearWishlist() {
    return await apiRequest('/wishlist/clear', {
      method: 'DELETE'
    });
  },

  // Check if product is in wishlist
  async checkWishlist(productId) {
    return await apiRequest(`/wishlist/check/${productId}`);
  }
};

// Export all APIs and helpers
window.API = {
  auth: authAPI,
  products: productsAPI,
  cart: cartAPI,
  artisan: artisanAPI,
  orders: ordersAPI,
  reviews: reviewsAPI,
  wishlist: wishlistAPI,
  helpers: uiHelpers
};

// Add a global error handler for unhandled promise rejections and errors
window.addEventListener('unhandledrejection', function(event) {
  const notification = document.createElement('div');
  notification.className = 'notification notification-error';
  notification.textContent = 'An unexpected error occurred. Please try again.';
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 4000);
  console.error('Unhandled promise rejection:', event.reason);
});
window.addEventListener('error', function(event) {
  const notification = document.createElement('div');
  notification.className = 'notification notification-error';
  notification.textContent = 'A critical error occurred. Please refresh the page.';
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 4000);
  console.error('Global error:', event.error || event.message);
});

// API health monitoring
let apiHealthCheckInterval;

// Initialize API on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing API...');
  
  // Check API connection with retry logic
  let apiConnected = false;
  let retries = 5; // Increased retries
  
  while (!apiConnected && retries > 0) {
    apiConnected = await checkApiConnection();
    
    if (!apiConnected) {
      console.log(`⏳ Retrying connection... (${retries} attempts left)`);
      retries--;
      if (retries > 0) {
        // Exponential backoff: 1s, 2s, 4s, 8s
        const delay = Math.pow(2, 5 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  if (!apiConnected) {
    console.error('❌ Backend API not available after multiple attempts.');
    showBackendError();
    return;
  }
  
  console.log('✅ API initialized successfully');
  
  // Start periodic health checks (API monitoring only)
  startHealthChecks();
});

// Show backend error message
function showBackendError() {
  const body = document.body;
  if (body) {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'backend-error';
    errorDiv.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255, 0, 0, 0.9); color: white;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; z-index: 9999;
    `;
    errorDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <h2>⚠️ Backend Server Not Available</h2>
        <p>The frontend cannot connect to the backend server on port 5000.</p>
        <div style="text-align: left; margin: 20px 0;">
          <h3>Troubleshooting Steps:</h3>
          <ol>
            <li><strong>Start the backend server:</strong><br>
                <code>cd backend && npm run dev</code></li>
            <li><strong>Check if port 5000 is free:</strong><br>
                <code>netstat -ano | findstr :5000</code></li>
            <li><strong>Verify server is running:</strong><br>
                Visit <a href="http://localhost:5000/api/health" target="_blank">http://localhost:5000/api/health</a></li>
            <li><strong>Check for firewall/antivirus blocking</strong></li>
          </ol>
        </div>
        <button onclick="retryConnection()" style="padding: 10px 20px; background: white; color: red; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">
          Retry Connection
        </button>
        <button onclick="window.open('http://localhost:5000/api/health', '_blank')" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">
          Test Backend
        </button>
      </div>
    `;
    body.appendChild(errorDiv);
  }
}

// Retry connection function
window.retryConnection = async function() {
  const errorDiv = document.getElementById('backend-error');
  if (errorDiv) {
    errorDiv.remove();
  }
  
  const apiConnected = await checkApiConnection();
  if (apiConnected) {
    location.reload();
  } else {
    showBackendError();
  }
};



// Clear session data (without automatic redirect)
function clearSession() {
  removeAuthToken();
  localStorage.removeItem('user');
  
  // Clear any cached data
  if (typeof window.products !== 'undefined') {
    window.products = [];
  }
  
  console.log('🔐 Session cleared - user can continue browsing or login manually');
}

// Start periodic health checks
function startHealthChecks() {
  // Only check API health, no automatic session validation
  // Check API health every 2 minutes
  apiHealthCheckInterval = setInterval(async () => {
    const isHealthy = await checkApiConnection();
    if (!isHealthy) {
      console.warn('⚠️ API health check failed');
      // Show connection status indicator
      showConnectionStatus(false);
      // Optionally show a notification to the user
      if (typeof showNotification === 'function') {
        showNotification('Connection to server lost. Please check your connection.', 'warning');
      }
    } else {
      showConnectionStatus(true);
    }
  }, 2 * 60 * 1000); // 2 minutes
}

// Show connection status indicator
function showConnectionStatus(isConnected) {
  let statusIndicator = document.getElementById('connection-status');
  
  if (!statusIndicator) {
    statusIndicator = document.createElement('div');
    statusIndicator.id = 'connection-status';
    statusIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 12px;
      font-weight: 600;
      z-index: 10000;
      transition: all 0.3s ease;
    `;
    document.body.appendChild(statusIndicator);
  }
  
  if (isConnected) {
    statusIndicator.textContent = '🟢 Connected';
    statusIndicator.style.background = '#dcfce7';
    statusIndicator.style.color = '#166534';
  } else {
    statusIndicator.textContent = '🔴 Disconnected';
    statusIndicator.style.background = '#fee2e2';
    statusIndicator.style.color = '#991b1b';
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (apiHealthCheckInterval) {
    clearInterval(apiHealthCheckInterval);
  }
}); 