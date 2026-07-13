/**
 * Service Worker for Broker Trading Platform
 * Handles offline caching, background sync, and push notifications
 */

const CACHE_NAME = 'broker-v4';
const RUNTIME_CACHE = 'broker-runtime';
const STATIC_CACHE = 'broker-static';
const DYNAMIC_CACHE = 'broker-dynamic';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/app/home.html',
  '/app/portfolio.html',
  '/app/deposits.html',
  '/app/withdraw.html',
  '/app/convert.html',
  '/app/signals.html',
  '/app/signal_detail.html',
  '/app/tiers.html',
  '/app/positions.html',
  '/app/settings.html',
  '/app/kyc.html',
  '/app/history.html',
  '/src/css/ui-kit.css',
  '/src/css/pages.css',
  '/src/css/app-shell.css',
  '/src/css/backoffice.css',
  '/src/js/supabaseClient.js',
  '/src/js/auth.js',
  '/src/js/authGuard.js',
  '/src/js/ui/notify.js',
  '/src/js/ui/components.js',
  '/src/js/money/money.js',
  '/src/js/api/api.js',
  '/src/js/app-shell.js',
  '/env.js'
];

// API endpoints that require network
const NETWORK_URLS = [
  '/functions/*',
  '/rest/v1/*',
  '/auth/v1/*'
];

// API endpoints that can be cached for longer periods
const CACHEABLE_URLS = [
  '/rest/v1/user/profile',
  '/rest/v1/portfolio/snapshot',
  '/rest/v1/prices/get',
  '/rest/v1/settings/get'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    self.skipWaiting()
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      });
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Network listener for online/offline status
self.addEventListener('online', () => {
  console.log('App is online');
});

self.addEventListener('offline', () => {
  console.log('App is offline');
});

// Fetch event listener
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url, self.location.origin);

  // Skip non-GET requests and external requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external resources
  if (!url.origin.startsWith(self.location.origin)) {
    return;
  }

  // Handle different caching strategies
  if (STATIC_ASSETS.includes(url.pathname)) {
    // Cache static assets - Cache First strategy
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request);
      })
    );
  } else if (CACHEABLE_URLS.some(urlPattern => url.pathname.startsWith(urlPattern))) {
    // Cache API responses - Network First with cache fallback
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
  } else if (NETWORK_URLS.some(urlPattern => url.pathname.startsWith(urlPattern))) {
    // Network requests - Always fetch from network
    event.respondWith(fetch(request));
  } else {
    // Dynamic content - Try network first, fallback to cache
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        } else {
          return caches.match(request);
        }
      })
    );
  }
});

// Background sync for critical data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-critical-data') {
    event.waitUntil((async () => {
      // Only show notification if permission is granted
      if (Notification.permission === 'granted') {
        await self.registration.showNotification('Syncing critical data...', {
          icon: '/icons/icon-96x96.png',
          badge: '!',
          tag: 'sync-critical-data'
        });
      }
      await syncCriticalData();
      // Only show notification if permission is granted
      if (Notification.permission === 'granted') {
        await self.registration.showNotification('Critical data synced successfully', {
          icon: '/icons/icon-96x96.png',
          badge: '✓',
          tag: 'sync-critical-data'
        });
      }
    })());
  }
});

// Periodic sync every 30 minutes
self.setInterval(() => {
  try {
    // Only show notification if permission is granted
    if (Notification.permission === 'granted') {
      self.registration.showNotification('Syncing data...', {
        icon: '/icons/icon-96x96.png',
        badge: '!',
        tag: 'periodic-sync'
      });
    }
    
    syncCriticalData().then(() => {
      // Only show notification if permission is granted
      if (Notification.permission === 'granted') {
        self.registration.showNotification('Data synced successfully', {
          icon: '/icons/icon-96x96.png',
          badge: '✓',
          tag: 'periodic-sync'
        });
      }
    });
  } catch (error) {
    // Prevent infinite error loops - only log once per error type
    if (!this._loggedErrors) this._loggedErrors = {};
    const errorKey = error.message || 'unknown';
    if (!this._loggedErrors[errorKey]) {
      console.warn('Service worker sync error:', error.message);
      this._loggedErrors[errorKey] = true;
    }
  }
}, 30 * 60 * 1000); // 30 minutes

// Sync critical data function
async function syncCriticalData() {
  try {
    // Skip sync if no access token available (service worker can't access localStorage)
    // The app will handle syncing when online
    
    // Sync user profile
    const profileResponse = await fetch('/rest/v1/user/profile');
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put('/rest/v1/user/profile', new Response(JSON.stringify(profileData), {
        headers: { 'Content-Type': 'api/json' }
      }));
    }

    // Sync portfolio snapshot
    const portfolioResponse = await fetch('/rest/v1/portfolio/snapshot');
    if (portfolioResponse.ok) {
      const portfolioData = await portfolioResponse.json();
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put('/rest/v1/portfolio/snapshot', new Response(JSON.stringify(portfolioData), {
        headers: { 'Content-Type': 'api/json' }
      }));
    }

    // Sync prices
    const pricesResponse = await fetch('/rest/v1/prices/get');
    if (pricesResponse.ok) {
      const pricesData = await pricesResponse.json();
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put('/rest/v1/prices/get', new Response(JSON.stringify(pricesData), {
        headers: { 'Content-Type': 'api/json' }
      }));
    }

    return true;
  } catch (error) {
    console.error('Failed to sync critical data:', error);
    return false;
  }
}


// Error boundary for service worker
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
  
  // Send error to main thread for display
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({
        type: 'SERVICE_WORKER_ERROR',
        error: {
          message: event.error.message,
          stack: event.error.stack,
          timestamp: new Date().toISOString()
        }
      });
    }
  });
});

// Message handler for main thread communication
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'SYNC_CRITICAL_DATA':
      syncCriticalData();
      break;
    case 'GET_CACHE_DATA':
      getCacheData(data.cacheName).then((data) => {
        event.ports[0].postMessage({
          type: 'CACHE_DATA_RESPONSE',
          cacheName: data.cacheName,
          data: data
        });
      });
      break;
    case 'CLEAR_CACHE':
      clearCache(data.cacheName).then(() => {
        event.ports[0].postMessage({
          type: 'CACHE_CLEARED',
          cacheName: data.cacheName
        });
      });
      break;
    default:
      console.log('Unknown message type:', type);
  }
});

// Helper functions
async function getCacheData(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const data = {};
  
  for (const key of keys) {
    const response = await cache.match(key);
    if (response) {
      try {
        data[key] = await response.json();
      } catch (error) {
        data[key] = null;
      }
    }
  }
  
  return data;
}

async function clearCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.map(key => cache.delete(key)));
  return true;
}

