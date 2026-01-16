
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

export function startInjector() {
    console.log("[ASMR-DL] Injector Started");

    function injectButtons() {
        const cards = document.querySelectorAll('.q-card:not(.asmr-dl-processed)');
        if (cards.length > 0) {
            // console.log(`[ASMR-DL] Found ${cards.length} new cards.`);
        }

        cards.forEach(card => {
            card.classList.add('asmr-dl-processed');
            const link = card.querySelector('a[href*="/work/RJ"]');
            if (!link) return;

            const href = link.getAttribute('href');
            const rjMatch = href.match(/(RJ\d+)/);
            if (!rjMatch) return;
            const rjCode = rjMatch[1];

            // Container
            let container = card.querySelector('.q-img__content');

            // Button
            const btn = document.createElement('button');
            btn.className = 'asmr-dl-btn';
            btn.setAttribute('data-rjcode', rjCode);

            // Initial Styles based on CURRENT queue
            // This prevents them from showing as "DL" then flashing (or not updating if queue doesn't change)
            const initialStyles = getButtonStyle(rjCode, currentQueue);

            Object.assign(btn.style, {
                position: 'absolute',
                zIndex: '10', // Lower z-index to sit behind site nav
                bottom: '10px',
                left: '10px',
                color: 'white',
                fontWeight: 'bold',
                border: '2px solid white',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                fontSize: '12px',
                padding: '4px 8px',
                pointerEvents: 'auto',
                ...initialStyles // Apply computed styles (color, text)
            });
            btn.textContent = initialStyles.textContent; // Apply text
            btn.title = initialStyles.title; // Apply title

            // Visual feedback on hover to verify interactivity
            btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';
            btn.onmouseleave = () => btn.style.transform = 'scale(1)';

            const handleClick = (e) => {
                e.preventDefault(); // CRITICAL: Stop link navigation
                e.stopPropagation(); // Stop bubbling to card
                e.stopImmediatePropagation();
                console.log(`[ASMR-DL] Button Clicked: ${rjCode}`);
                window.dispatchEvent(new CustomEvent('asmr-dl-request', { detail: { rjCode } }));
                return false;
            };

            // Bind to both click and mousedown to be safe against aggressive frameworks
            btn.addEventListener('click', handleClick);
            btn.addEventListener('mousedown', (e) => e.stopPropagation());
            btn.addEventListener('mouseup', (e) => e.stopPropagation());

            if (container) {
                container.appendChild(btn);
            } else {
                card.style.position = 'relative';
                btn.style.bottom = 'auto';
                btn.style.top = '10px';
                btn.style.left = '10px';
                card.appendChild(btn);
            }
        });
    }

    const observer = new MutationObserver(debounce(() => {
        injectButtons();
    }, 200));

    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(injectButtons, 2000);
    injectButtons();
}

// Helper to determine style
function getButtonStyle(rjCode, queue) {
    const item = queue.find(i => i.rjCode === rjCode);
    if (item) {
        if (item.status === 'completed') {
            return { backgroundColor: '#4caf50', textContent: '✔', title: 'Downloaded' };
        } else if (item.status === 'error') {
            return { backgroundColor: '#f44336', textContent: '✖', title: 'Error' };
        } else {
            // Downloading or Pending
            let text = '...';
            if (item.status === 'downloading') text = `${item.progress}%`;
            return { backgroundColor: '#2196f3', textContent: text, title: item.status };
        }
    }
    // Default
    return { backgroundColor: '#e91e63', textContent: 'DL', title: `Download ${rjCode}` };
}

export function updateButtonStyles(queue) {
    currentQueue = queue; // Update local cache

    document.querySelectorAll('.asmr-dl-btn').forEach(btn => {
        const rjCode = btn.getAttribute('data-rjcode');
        if (!rjCode) return;

        const styles = getButtonStyle(rjCode, queue);
        Object.assign(btn.style, { backgroundColor: styles.backgroundColor });
        btn.textContent = styles.textContent;
        btn.title = styles.title; // optional
    });
}
