# Progressive Web App (PWA) Support

Bagh Chal is installable as a PWA and can be run offline.

## How it works

- The app registers a service worker (`service-worker.js`) that caches all essential assets for offline use.
- The manifest (`manifest.json`) is configured for installability and standalone display.
- The app can be installed to your device from supported browsers ("Add to Home Screen" or "Install App").

## Development Notes

- To test offline mode, build and serve from a local HTTP server (not file://).
- To update the cache, increment the `CACHE_NAME` in `service-worker.js`.
- Service worker and manifest are referenced in `index.html`.

## Files

- `service-worker.js`: Handles caching and offline support.
- `manifest.json`: Describes the app for installability.
- `index.html`: Registers the service worker and links the manifest.

## Troubleshooting

- If changes are not reflected, clear the browser cache or unregister the service worker.
- All assets referenced in `service-worker.js` must be available at the specified paths.
