// Main JS for Crochet Arty frontend with Backend Integration

// Global variables
let products = [];
let selectedCategory = 'All';
let currentSort = 'az';
let currentPage = 1;
let totalPages = 1;

// Initialize the application
async function initializeApp() {
  try {
    // Load products from API
    await loadProducts();
    
    // Set up event listeners
    setupEventListeners();
    
    // Render products
    renderProducts();
    
    // Update cart summary
    updateCartSummary();
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

// Load products from API
async function loadProducts() {
  try {
    const filters = {
      page: currentPage,
      limit: 12,
      category: selectedCategory !== 'All' ? selectedCategory : '',
      sort: currentSort
    };
    // Remove category if empty string
    if (!filters.category) {
      delete filters.category;
    }
    
    const response = await API.products.getAllProducts(filters);
    
    if (response.success) {
      products = response.data.products;
      totalPages = response.data.pagination.totalPages;
      currentPage = response.data.pagination.currentPage;
    } else {
      products = [];
      showNotification('Failed to load products from backend.', 'error');
    }
  } catch (error) {
    products = [];
    console.error('Product loading error from main.js:', error);
    showNotification('Failed to load products from backend. Please check your connection.', 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Category filter buttons
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      selectedCategory = this.getAttribute('data-category');
      currentPage = 1;
      loadProducts().then(() => renderProducts());
    });
  });

  // Search bar
  const searchBar = document.getElementById('searchBar');
  if (searchBar) {
    searchBar.addEventListener('input', debounce(async (e) => {
      const query = e.target.value.trim();
      if (query.length > 2) {
        try {
          const response = await API.products.searchProducts(query);
          if (response.success) {
            products = response.data.products;
            renderProducts();
          }
        } catch (error) {
          console.error('Search failed:', error);
        }
      } else if (query.length === 0) {
        loadProducts().then(() => renderProducts());
      }
    }, 500));
  }

  // Sort filter
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    sortFilter.addEventListener('change', async (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      await loadProducts();
      renderProducts();
    });
  }
}

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Render products
function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  grid.innerHTML = '';

  if (products.length === 0) {
    grid.innerHTML = '<div class="no-products">No products found.</div>';
    return;
  }

  products.forEach(product => {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.innerHTML = `
      <div class="product-wishlist">
        <button class="wishlist-btn" onclick="toggleWishlist('${product._id}')" data-product-id="${product._id}" title="Add to wishlist">
          ♡
        </button>
      </div>
      <img src="${product.images[0] || 'images/placeholder.jpg'}" alt="${product.title}" class="product-img">
      <div class="product-info">
        <h2 class="product-title">${product.title}</h2>
        <p class="product-price">${API.helpers.formatPrice(product.price)}</p>
        <p class="product-desc">${product.description.substring(0, 100)}${product.description.length > 100 ? '...' : ''}</p>
        <span class="product-category">${product.category}</span>
        <div class="product-rating">
          ${'★'.repeat(Math.floor(product.ratings.average))}${'☆'.repeat(5 - Math.floor(product.ratings.average))}
          <span class="rating-count">(${product.ratings.count})</span>
        </div>
        <div class="product-actions">
          <button class="btn btn-primary" onclick="addToCart('${product._id}')">Add to Cart</button>
          <a href="product.html?id=${product._id}" class="btn btn-outline">View Details</a>
        </div>
      </div>
    `;
    grid.appendChild(productCard);
  });

  // Load wishlist status for authenticated users
  if (API.helpers.isAuthenticated()) {
    loadWishlistStatus();
  }

  // Render pagination if needed
  renderPagination();
}

// Render pagination
function renderPagination() {
  const paginationContainer = document.getElementById('pagination');
  if (!paginationContainer || totalPages <= 1) return;

  let paginationHTML = '<div class="pagination">';
  
  // Previous button
  if (currentPage > 1) {
    paginationHTML += `<button class="btn btn-outline" onclick="changePage(${currentPage - 1})">Previous</button>`;
  }
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      paginationHTML += `<button class="btn btn-primary" disabled>${i}</button>`;
    } else {
      paginationHTML += `<button class="btn btn-outline" onclick="changePage(${i})">${i}</button>`;
    }
  }
  
  // Next button
  if (currentPage < totalPages) {
    paginationHTML += `<button class="btn btn-outline" onclick="changePage(${currentPage + 1})">Next</button>`;
  }
  
  paginationHTML += '</div>';
  paginationContainer.innerHTML = paginationHTML;
}

// Change page
async function changePage(page) {
  currentPage = page;
  await loadProducts();
  renderProducts();
  window.scrollTo(0, 0);
}

// Add to cart function
async function addToCart(productId) {
  if (!API.helpers.isAuthenticated()) {
    showNotification('Please login to add items to cart', 'info');
    return;
  }

  try {
    const response = await API.cart.addToCart(productId, 1);
    
    if (response.success) {
      // Show success message
      showNotification('Product added to cart!', 'success');
      
      // Update cart summary
      updateCartSummary();
    } else {
      showNotification(response.message || 'Failed to add to cart', 'error');
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    showNotification('Failed to add to cart. Please try again.', 'error');
  }
}

// Load wishlist status
async function loadWishlistStatus() {
  try {
    const response = await API.wishlist.getWishlist();
    if (response.success) {
      const wishlistProductIds = response.data.wishlist.products.map(item => item.product._id);
      
      // Update wishlist buttons
      document.querySelectorAll('.wishlist-btn').forEach(btn => {
        const productId = btn.getAttribute('data-product-id');
        if (wishlistProductIds.includes(productId)) {
          btn.textContent = '♥';
          btn.classList.add('in-wishlist');
          btn.title = 'Remove from wishlist';
        }
      });
    }
  } catch (error) {
    console.error('Failed to load wishlist status:', error);
  }
}

// Toggle wishlist
async function toggleWishlist(productId) {
  if (!API.helpers.isAuthenticated()) {
    showNotification('Please login to manage your wishlist', 'info');
    return;
  }

  const btn = document.querySelector(`[data-product-id="${productId}"]`);
  const isInWishlist = btn.classList.contains('in-wishlist');

  try {
    let response;
    if (isInWishlist) {
      response = await API.wishlist.removeFromWishlist(productId);
      if (response.success) {
        btn.textContent = '♡';
        btn.classList.remove('in-wishlist');
        btn.title = 'Add to wishlist';
        showNotification('Removed from wishlist', 'success');
      }
    } else {
      response = await API.wishlist.addToWishlist(productId);
      if (response.success) {
        btn.textContent = '♥';
        btn.classList.add('in-wishlist');
        btn.title = 'Remove from wishlist';
        showNotification('Added to wishlist', 'success');
      }
    }
  } catch (error) {
    console.error('Toggle wishlist error:', error);
    showNotification('Failed to update wishlist', 'error');
  }
}

// Expose functions globally for onclick handlers
window.addToCart = addToCart;
window.toggleWishlist = toggleWishlist;

// Update cart summary
async function updateCartSummary() {
  if (!API.helpers.isAuthenticated()) return;

  try {
    const response = await API.cart.getCartSummary();
    
    if (response.success) {
      const cartSummary = document.getElementById('cartSummary');
      if (cartSummary) {
        cartSummary.textContent = response.data.totalItems || 0;
      }
    }
  } catch (error) {
    console.error('Failed to update cart summary:', error);
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Expose showNotification globally
window.showNotification = showNotification;

// Legacy function for backward compatibility
window.makeProductEditable = function(idx) {
  const products = JSON.parse(localStorage.getItem('artisanProducts') || '[]');
  const product = products[idx];
  document.getElementById('prodTitle').value = product.title;
  document.getElementById('prodPrice').value = product.price;
  document.getElementById('prodImage').value = product.image;
  document.getElementById('prodDesc').value = product.description;
  document.getElementById('prodCategory').value = product.category || '';
  window.deleteProduct(idx);
}; 

// Cleanup function to prevent memory leaks
function cleanup() {
  // Clear any intervals or timeouts
  if (window.searchTimeout) {
    clearTimeout(window.searchTimeout);
  }
  
  // Remove event listeners
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.removeEventListener('click', btn.clickHandler);
  });
  
  const searchBar = document.getElementById('searchBar');
  if (searchBar && searchBar.inputHandler) {
    searchBar.removeEventListener('input', searchBar.inputHandler);
  }
  
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter && sortFilter.changeHandler) {
    sortFilter.removeEventListener('change', sortFilter.changeHandler);
  }
}

// Enhanced setup event listeners with cleanup tracking
function setupEventListeners() {
  // Category filter buttons
  document.querySelectorAll('.category-btn').forEach(btn => {
    const clickHandler = function() {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      selectedCategory = this.getAttribute('data-category');
      currentPage = 1;
      loadProducts().then(() => renderProducts());
    };
    btn.clickHandler = clickHandler; // Store reference for cleanup
    btn.addEventListener('click', clickHandler);
  });

  // Search bar with improved debouncing
  const searchBar = document.getElementById('searchBar');
  if (searchBar) {
    const inputHandler = debounce(async (e) => {
      const query = e.target.value.trim();
      if (query.length > 2) {
        try {
          const response = await API.products.searchProducts(query);
          if (response.success) {
            products = response.data.products;
            renderProducts();
          }
        } catch (error) {
          console.error('Search failed:', error);
          showNotification('Search failed. Please try again.', 'error');
        }
      } else if (query.length === 0) {
        loadProducts().then(() => renderProducts());
      }
    }, 500);
    searchBar.inputHandler = inputHandler; // Store reference for cleanup
    searchBar.addEventListener('input', inputHandler);
  }

  // Sort filter
  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    const changeHandler = async (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      await loadProducts();
      renderProducts();
    };
    sortFilter.changeHandler = changeHandler; // Store reference for cleanup
    sortFilter.addEventListener('change', changeHandler);
  }
}

// Enhanced debounce function with cleanup
function debounce(func, wait) {
  let timeout;
  const debounced = function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    window.searchTimeout = timeout; // Store for cleanup
  };
  
  debounced.cancel = function() {
    clearTimeout(timeout);
  };
  
  return debounced;
}

// Page visibility handling to pause/resume operations
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    // Page is hidden, pause operations
    console.log('📱 Page hidden, pausing operations');
  } else {
    // Page is visible, resume operations
    console.log('📱 Page visible, resuming operations');
    // Refresh data if needed
    if (API.helpers.isAuthenticated()) {
      updateCartSummary();
    }
  }
});

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup); 