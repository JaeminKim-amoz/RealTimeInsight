/**
 * main.tsx — Vite entry point for the RealTimeInsight workstation.
 *
 * Imports fonts via @fontsource (replacing the prototype's Google Fonts CDN link),
 * the canonical workstation stylesheet, and maplibre-gl's CSS. Renders <App/> at #root.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

// @fontsource — IBM Plex Sans (300, 400, 500, 600, 700) + JetBrains Mono (400, 500, 600).
import '@fontsource/ibm-plex-sans/300.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';

// MapLibre default stylesheet — replaces prototype's CDN <link>.
import 'maplibre-gl/dist/maplibre-gl.css';

// Workstation theme (1746 LOC verbatim port of public/app/styles.css).
import '../styles/app.css';

import { App } from './App';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('main.tsx: #root element missing');
}

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
