
import './injector.css';

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Store queue locally to apply styles to new buttons immediately
let currentQueue = [];
let observer = null;

export function startInjector() {
    console.log("[ASMR-DL] Injector Started");

    // Initial run
    injectButtons();

    // Setup Observer (Single source of truth for DOM changes)
    // We only need one observer for the entire lifetime
    if (!observer) {
        observer = new MutationObserver(debounce(() => {
            injectButtons();
        }, 200));

        // Observe the body for any added nodes
        observer.observe(document.body, { childList: true, subtree: true });
    }
}

function injectButtons() {
    // Find all cards that haven't been processed yet
    const cards = document.querySelectorAll('.q-card:not(.asmr-dl-processed)');

    cards.forEach(card => {
        // Mark as processed immediately to avoid duplicate work
        card.classList.add('asmr-dl-processed');

        // Check if this card contains an RJ link
        const link = card.querySelector('a[href*="/work/RJ"]');
        if (!link) return;

        const href = link.getAttribute('href');
        const rjMatch = href.match(/(RJ\d+)/);
        if (!rjMatch) return;

        const rjCode = rjMatch[1];
        createButton(card, rjCode);
    });
}

function createButton(card, rjCode) {
    // Container
    let container = card.querySelector('.q-img__content');

    // Button
    const btn = document.createElement('button');
    btn.className = 'asmr-dl-btn'; // Base class from injector.css
    btn.setAttribute('data-rjcode', rjCode);

    // Initial Visuals
    updateSingleButtonVisuals(btn, rjCode);

    // Event Handling
    const handleClick = (e) => {
        e.preventDefault(); // CRITICAL: Stop link navigation
        e.stopPropagation(); // Stop bubbling to card
        e.stopImmediatePropagation();
        console.log(`[ASMR-DL] Button Clicked: ${rjCode}`);
        window.dispatchEvent(new CustomEvent('asmr-dl-request', { detail: { rjCode } }));
        return false;
    };

    // Bind to click and stop propagation on other mouse events to prevent card activation
    btn.addEventListener('click', handleClick);
    ['mousedown', 'mouseup'].forEach(evt =>
        btn.addEventListener(evt, e => e.stopPropagation())
    );

    // Append to DOM
    if (container) {
        container.appendChild(btn);
    } else {
        // Fallback for weird card structures
        card.style.position = 'relative';
        // Force specific positioning if not in the standard container
        btn.style.top = '10px';
        btn.style.bottom = 'auto'; // Reset bottom if set in CSS
        btn.style.left = '10px';
        card.appendChild(btn);
    }
}

// Helper to update a single button's state based on the queue
function updateSingleButtonVisuals(btn, rjCode) {
    const item = currentQueue.find(i => i.rjCode === rjCode);

    // Reset status classes
    btn.classList.remove('status-completed', 'status-error', 'status-downloading');

    if (item) {
        if (item.status === 'completed') {
            btn.classList.add('status-completed');
            btn.textContent = '✔';
            btn.title = 'Downloaded';
        } else if (item.status === 'error') {
            btn.classList.add('status-error');
            btn.textContent = '✖';
            btn.title = 'Error';
        } else {
            // Downloading or Pending
            btn.classList.add('status-downloading');
            const text = item.status === 'downloading' ? `${item.progress}%` : '...';
            btn.textContent = text;
            btn.title = item.status;
        }
    } else {
        // Default / Idle
        btn.textContent = 'DL';
        btn.title = `Download ${rjCode}`;
    }
}

// Public API to update all buttons when queue changes
export function updateButtonStyles(queue) {
    currentQueue = queue; // Update local cache

    document.querySelectorAll('.asmr-dl-btn').forEach(btn => {
        const rjCode = btn.getAttribute('data-rjcode');
        if (rjCode) {
            updateSingleButtonVisuals(btn, rjCode);
        }
    });
}

