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
  '/register.html',
  '/login.html',
  '/app/home.html',
  '/app/portfolio.html',
  '/app/deposits.html',
  '/app/withdraw.html',
  '/app/convert.html',
  '/app/history.html',
  '/app/settings.html',
  '/app/signals.html',
  '/app/tiers.html',
  '/app/positions.html',
  '/app/support.html',
  '/app/more.html',
  '/app/kyc.html',
  '/app/signal_detail.html',
  '/assets/css/ui-kit.css',
  '/assets/css/pwa.css',
  '/assets/js/env.js',
  '/assets/js/supabaseClient.js',
  '/assets/js/api.js',
  '/assets/js/auth.js',
  '/assets/js/authGuard.js',
  '/assets/js/money.js',
  '/assets/js/notify.js',
  '/assets/js/components.js',
  '/assets/js/errorBoundary.js',
  '/assets/js/pwaManager.js',
  '/assets/js/index.js',
  '/manifest.json'
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
    self.skipWaiting().then(() => {
      self.clients.claim();
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil().then(() => {
    return caches.open(CACHE_NAME);
  }).then((cache) => {
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
  });
});

// Network listener for online/offline status
self.addEventListener('online', () => {
  console.log('App is online');
  if (window.Notify) {
    window.Notify.success('Connection restored');
  }
});

self.addEventListener('offline', () => {
  console.log('App is offline');
  if (window.Notify) {
    window.Notify.warning('Connection lost - working offline');
  }
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
    event.waitUntil().then(() => {
      return self.registration.showNotification('Syncing critical data...', {
        icon: '/icons/icon-96x96.png',
        badge: '!',
        tag: 'sync-critical-data'
      });
    }).then(() => {
      return syncCriticalData();
    }).then(() => {
      self.registration.showNotification('Critical data synced successfully', {
        icon: '/icons/icon-96x96.png',
        badge: '✓',
        tag: 'sync-critical-data'
      });
    });
  }
});

// Periodic sync every 30 minutes
self.setInterval(() => {
  self.registration.showNotification('Syncing data...', {
    icon: '/icons/icon-96x96.png',
    badge: '!',
    tag: 'periodic-sync'
  });
  syncCriticalData().then(() => {
    self.registration.showNotification('Data synced successfully', {
      icon: '/icons/icon-96x96.png',
      badge: '✓',
      tag: 'periodic-sync'
    });
  });
}, 30 * 60 * 1000); // 30 minutes

// Sync critical data function
async function syncCriticalData() {
  try {
    // Sync user profile
    const profileResponse = await fetch('/rest/v1/user/profile', {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('access_token')
      }
    });

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put('/rest/v1/user/profile', new Response(JSON.stringify(profileData), {
        headers: { 'Content-Type': 'api/json' }
      }));
    }

    // Sync portfolio snapshot
    const portfolioResponse = await fetch('/rest/v1/portfolio/snapshot', {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('access_token')
      }
    });

    if (portfolioResponse.ok) {
      const portfolioData = await portfolioResponse.json();
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put('/rest/v1/portfolio/snapshot', new Response(JSON.stringify(portfolioData), {
        headers: { 'Content-Type': 'api/json' }
      }));
    }

    // Sync prices
    const pricesResponse = await fetch('/rest/v1/prices/get', {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('access_token')
      }
    });

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

// Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil().then(() => {
    return caches.open(CACHE_NAME);
  }).then((cache) => {
    return cache.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    });
  });
});

// Error boundary for service worker
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
  
  // Send error to main thread for display
  self.clients.forEach((client) => {
    client.postMessage({
      type: 'SERVICE_WORKER_ERROR',
      error: {
        message: event.error.message,
        stack: event.error.stack,
        timestamp: new Date().toISOString()
      }
    });
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

// Cache version management
self.addEventListener('activate', (event) => {
  event.waitUntil().then(() => {
    return caches.open(CACHE_NAME);
  }).then((cache) => {
    return cache.match('/assets/js/env.js').then((response) => {
      if (response) {
        return cache.put('/assets/js/env.js', response.clone());
      }
    });
  });
});
