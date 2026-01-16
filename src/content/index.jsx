
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';

// Create a container for the Shadow DOM
const rootContainer = document.createElement('div');
rootContainer.id = 'asmr-download-manager-root';
rootContainer.style.position = 'absolute';
rootContainer.style.top = '0';
rootContainer.style.left = '0';
rootContainer.style.width = '0';
rootContainer.style.height = '0';
rootContainer.style.zIndex = '2147483647';
rootContainer.style.pointerEvents = 'none'; // Passthrough unless hitting a child
document.body.appendChild(rootContainer);

// Create Shadow DOM
const shadowRoot = rootContainer.attachShadow({ mode: 'open' });

// Mount React
const root = ReactDOM.createRoot(shadowRoot);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

console.log("[ASMR-DL] React App Mounted");
