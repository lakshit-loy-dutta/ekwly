const CACHE_NAME = "fairsplit-v2";
const ASSETS_TO_CACHE = [
	"./",
	"./index.html",
	"./styles.css",
	"./app.js",
	"./manifest.json",
	// Cache the PDF libraries so export works offline
	"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
	"https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js",
	// Cache the Google Font
	"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
];

// Install Event: Cache all critical assets
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(ASSETS_TO_CACHE);
		}),
	);
	self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

// Activate Event: Clean up old caches
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cache) => {
					if (cache !== CACHE_NAME) {
						return caches.delete(cache);
					}
				}),
			);
		}),
	);
	self.clients.claim(); // Take control of all pages immediately
});

// Fetch Event: Cache-First strategy for offline functionality
self.addEventListener("fetch", (event) => {
	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			// Return cached version if found, otherwise fetch from network
			return cachedResponse || fetch(event.request);
		}),
	);
});
