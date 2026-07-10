/**
 * Application Entry Point
 *
 * Mounts the React app and registers the service worker for PWA support.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.info('[clio] build', __BUILD_ID__);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.debug('SW registration failed:', err);
    });
  });
}
