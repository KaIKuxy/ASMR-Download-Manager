
// Content Script (Robust Version)

let isWidgetVisible = true;

// --- DOM Observer & Injection Logic ---

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

let lastKnownQueue = [];

// Main Injection Function
function injectButtons() {
    // Select all cards that haven't been processed yet
    // We look for .q-card
    const cards = document.querySelectorAll('.q-card:not(.asmr-dl-processed)');

    if (cards.length > 0) {
        console.log(`[ASMR-DL] Found ${cards.length} new cards.`);
    }

    cards.forEach(card => {
        card.classList.add('asmr-dl-processed');

        // 1. Find the RJ Code
        // The structure is usually .q-card > a > ...
        const link = card.querySelector('a[href*="/work/RJ"]');
        if (!link) {
            // Fallback: Check if the card itself has the text or if we can find it structurally
            // But the link is the most reliable way to get the ID
            return;
        }

        const href = link.getAttribute('href');
        const rjMatch = href.match(/(RJ\d+)/);
        if (!rjMatch) return;
        const rjCode = rjMatch[1];

        // 2. Determine where to put the button
        // The image overlay (.q-img__content) is the best place
        let container = card.querySelector('.q-img__content');

        // Create the button
        const btn = document.createElement('button');
        btn.className = 'asmr-dl-btn';
        btn.textContent = 'DL';
        btn.setAttribute('data-rjcode', rjCode); // Store for easier lookup
        btn.title = `Download ${rjCode}`;

        // Style it to be very visible
        btn.style.position = 'absolute';
        btn.style.zIndex = '10'; // Lowered from 99999 to sit below navbars
        btn.style.bottom = '10px';
        btn.style.left = '10px';
        btn.style.backgroundColor = '#e91e63'; // Pink
        btn.style.color = 'white';
        btn.style.fontWeight = 'bold';
        btn.style.border = '2px solid white';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
        btn.style.fontSize = '12px';
        btn.style.padding = '4px 8px';

        // Click Handler
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`[ASMR-DL] Opening selection for ${rjCode}`);
            showSelectionModal(rjCode);
        });

        // Append to container
        if (container) {
            // Ensure relative positioning on container isn't messing us up (it should be absolute-full)
            container.appendChild(btn);
        } else {
            // Fallback: Append to the card wrapper itself
            card.style.position = 'relative'; // Ensure positioning context
            btn.style.bottom = 'auto';
            btn.style.top = '10px';
            btn.style.left = '10px';
            card.appendChild(btn);
        }
    });

    // Re-apply statuses if we have them
    if (cards.length > 0 && lastKnownQueue.length > 0) {
        updatePageButtons(lastKnownQueue);
    }
}

// 1. Run on Mutation
const observer = new MutationObserver(debounce(() => {
    injectButtons();
}, 200));

observer.observe(document.body, { childList: true, subtree: true });

// 2. Run on Interval (Fallback for missed mutations)
setInterval(injectButtons, 2000);

// 3. Run immediately
injectButtons();


// --- Floating Widget UI ---

// --- Floating Widget UI ---

const widget = document.createElement('div');
widget.id = 'asmr-dl-manager';

// Force inline styles to guarantee visibility
Object.assign(widget.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '300px',
    backgroundColor: '#1d1d1d',
    color: '#fff',
    border: '2px solid #555',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
    fontFamily: 'sans-serif',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '400px'
});

widget.innerHTML = `
  <div id="asmr-dl-header" style="padding: 10px; background-color: #2d2d2d; border-bottom: 1px solid #333; cursor: move; display: flex; justify-content: space-between; align-items: center;">
    <span style="font-weight:bold;">Download Manager</span>
    <div style="display:flex; gap: 10px; align-items: center;">
        <button id="asmr-dl-settings-btn" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:14px;" title="Settings">⚙️</button>
        <button id="asmr-dl-minimize" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;font-weight:bold;">–</button>
    </div>
  </div>
  
  <div id="asmr-dl-settings" style="display:none; padding:10px; background:#222; border-bottom:1px solid #333;">
      <label style="display:block; font-size:12px; color:#aaa; margin-bottom:4px;">Download Folder:</label>
      <div style="display:flex; gap:5px;">
          <input type="text" id="asmr-dl-root-input" placeholder="e.g. ASMR" style="flex:1; background:#333; border:1px solid #555; color:white; padding:4px; border-radius:4px;">
          <button id="asmr-dl-save-settings" style="background:#e91e63; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Save</button>
      </div>
      <div style="font-size:10px; color:#666; margin-top:4px;">Relative to Downloads folder</div>
  </div>

  <div id="asmr-dl-list" style="overflow-y: auto; padding: 10px; max-height: 300px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">
        <span style="font-size:12px; color:#888;">Queue</span>
        <button id="asmr-dl-clear" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:11px;text-decoration:underline;">Clear Finished</button>
    </div>
    <div id="asmr-dl-list-content">
        <div style="text-align:center;color:#888;padding:10px;">Queue empty</div>
    </div>
  </div>
`;

// Append to document root for safety
(document.body || document.documentElement).appendChild(widget);

// Bind Settings Toggle
widget.querySelector('#asmr-dl-settings-btn').onclick = () => {
    const s = widget.querySelector('#asmr-dl-settings');
    s.style.display = s.style.display === 'none' ? 'block' : 'none';
};

// Bind Save Settings
widget.querySelector('#asmr-dl-save-settings').onclick = () => {
    const val = widget.querySelector('#asmr-dl-root-input').value;
    chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', root: val }, (res) => {
        if (res && res.success) {
            const btn = widget.querySelector('#asmr-dl-save-settings');
            const originalText = btn.textContent;
            btn.textContent = 'Saved!';
            btn.style.backgroundColor = '#4caf50';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.backgroundColor = '#e91e63';
                widget.querySelector('#asmr-dl-settings').style.display = 'none';
            }, 1000);
        }
    });
};

// Bind Minimize
widget.querySelector('#asmr-dl-minimize').onclick = () => {
    const list = widget.querySelector('#asmr-dl-list');
    const settings = widget.querySelector('#asmr-dl-settings');

    if (list.style.display === 'none') {
        list.style.display = 'block';
    } else {
        list.style.display = 'none';
        settings.style.display = 'none'; // Hide settings too
    }
};

// Bind Clear Button
widget.querySelector('#asmr-dl-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'CLEAR_COMPLETED' }, (response) => {
        if (response && response.queue) renderQueue(response.queue);
    });
});

// Drag Logic provided by helper (simplified here)
const header = widget.querySelector('#asmr-dl-header');
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

header.addEventListener("mousedown", dragStart);
document.addEventListener("mouseup", dragEnd);
document.addEventListener("mousemove", drag);

function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    if (e.target === header || e.target.parentNode === header) {
        isDragging = true;
    }
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        setTranslate(currentX, currentY, widget);
    }
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'QUEUE_UPDATE') {
        renderQueue(message.queue);
    }
});

// Request initial state
chrome.runtime.sendMessage({ type: 'GET_QUEUE' }, (response) => {
    if (response) {
        if (response.queue) renderQueue(response.queue);
        if (response.root !== undefined) {
            widget.querySelector('#asmr-dl-root-input').value = response.root;
        }
    }
});

function renderQueue(queue) {
    lastKnownQueue = queue;
    // Always update page buttons first, even if queue is empty
    updatePageButtons(queue);

    const listContent = document.getElementById('asmr-dl-list-content');
    if (!queue || queue.length === 0) {
        listContent.innerHTML = '<div style="text-align:center;color:#888;padding:10px;">Queue empty</div>';
        return;
    }

    listContent.innerHTML = '';

    queue.forEach(item => {
        const div = document.createElement('div');
        div.className = 'dl-item';
        div.style.marginBottom = '8px';
        div.style.padding = '8px';
        div.style.backgroundColor = '#262626';
        div.style.borderRadius = '4px';
        div.style.fontSize = '12px';

        let statusText = item.status;
        if (item.status === 'downloading') {
            statusText = `${item.progress}% (${item.completedFiles}/${item.totalFiles})`;
        } else if (item.status === 'pending') {
            statusText = 'Pending...';
        } else if (item.status === 'fetching_info') {
            statusText = 'Fetching Info...';
        }

        div.innerHTML = `
      <div class="dl-item-header" style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-weight:bold;">${item.rjCode}</span>
        <span>${statusText}</span>
      </div>
      <div class="dl-progress-bar" style="height: 4px; background-color: #444; border-radius: 2px; overflow: hidden;">
        <div class="dl-progress-fill" style="width: ${item.progress}%; height: 100%; background-color: #e91e63; transition: width 0.3s;"></div>
      </div>
      <div class="dl-controls" style="margin-top: 6px; display: flex; gap: 8px;">
        ${(item.status === 'downloading' || item.status === 'pending') ?
                `<button class="dl-action-btn" data-action="pause" style="background:none;border:none;color:#aaa;cursor:pointer;">⏸ Pause</button>` :
                item.status === 'paused' ? `<button class="dl-action-btn" data-action="resume" style="background:none;border:none;color:#aaa;cursor:pointer;">▶ Resume</button>` :
                    item.status === 'error' ? `<button class="dl-action-btn" data-action="retry" style="background:none;border:none;color:#ffa726;cursor:pointer;">↻ Retry</button>` : ''
            }
        ${item.status !== 'completed' ?
                `<button class="dl-action-btn" data-action="cancel" style="background:none;border:none;color:#aaa;cursor:pointer;">✖ Cancel</button>` :
                `<span style="color:#4caf50;">✔ Done</span>`
            }
      </div>
    `;

        // Bind buttons
        const pauseBtn = div.querySelector('[data-action="pause"]');
        if (pauseBtn) pauseBtn.onclick = () => chrome.runtime.sendMessage({ type: 'PAUSE_ITEM', rjCode: item.rjCode });

        const resumeBtn = div.querySelector('[data-action="resume"]');
        if (resumeBtn) resumeBtn.onclick = () => chrome.runtime.sendMessage({ type: 'RESUME_ITEM', rjCode: item.rjCode });

        const retryBtn = div.querySelector('[data-action="retry"]');
        if (retryBtn) retryBtn.onclick = () => chrome.runtime.sendMessage({ type: 'RETRY_ITEM', rjCode: item.rjCode });

        const cancelBtn = div.querySelector('[data-action="cancel"]');
        if (cancelBtn) cancelBtn.onclick = () => chrome.runtime.sendMessage({ type: 'CANCEL_ITEM', rjCode: item.rjCode });

        listContent.appendChild(div);
    });

    // List rendering complete
}

function updatePageButtons(queue) {
    // We can't easily map back from RJ code to button unless we store it or query it.
    // Querying is fine.
    document.querySelectorAll('.asmr-dl-btn').forEach(btn => {
        // We need to know which RJ code this button belongs to.
        // We didn't store it on the button element directly, let's fix that.
        // Actually, we can get it from the title "Download RJxxxxx".
        // Use reliable data attribute instead of parsing title (which changes)
        const rjCode = btn.getAttribute('data-rjcode');
        if (!rjCode) return;

        const item = queue.find(i => i.rjCode === rjCode);

        if (item) {
            if (item.status === 'completed') {
                btn.textContent = '✔';
                btn.style.backgroundColor = '#4caf50'; // Green
                btn.title = 'Downloaded';
            } else if (item.status === 'error') {
                btn.textContent = '✖';
                btn.style.backgroundColor = '#f44336'; // Red
            } else {
                // Downloading or Pending
                btn.textContent = '...';
                btn.style.backgroundColor = '#2196f3'; // Blue
                if (item.status === 'downloading') {
                    btn.textContent = `${item.progress}%`;
                }
            }
        } else {
            // Not in queue (or cleared)
            btn.textContent = 'DL';
            btn.style.backgroundColor = '#e91e63'; // Reset to Pink
            btn.title = `Download ${rjCode}`;
        }
    });
}

function showWidget() {
    widget.style.display = 'flex';
}


// --- Selection Modal Logic ---

function showSelectionModal(rjCode) {
    // 1. Create Modal Container
    const modalId = 'asmr-dl-modal';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove(); // Reset if exists

    modal = document.createElement('div');
    modal.id = modalId;
    Object.assign(modal.style, {
        position: 'fixed',
        top: '0', left: '0',
        width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: '2147483647',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'sans-serif'
    });

    modal.innerHTML = `
        <div style="background:#222; width:600px; max-height:80vh; display:flex; flex-direction:column; border-radius:8px; border:1px solid #444; color:white;">
            <div style="padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:16px;">Download Selection: ${rjCode}</h3>
                <button id="asmr-modal-close" style="background:none; border:none; color:#aaa; font-size:20px; cursor:pointer;">&times;</button>
            </div>
            
            <div style="padding:10px; background:#1a1a1a; display:flex; gap:10px; flex-wrap:wrap; border-bottom:1px solid #333;" id="asmr-modal-filters">
                <!-- Filters injected here -->
                <span style="color:#888; font-size:12px;">Loading extensions...</span>
            </div>

            <div id="asmr-modal-tree" style="flex:1; overflow-y:auto; padding:15px; font-size:13px; line-height:1.5;">
                <div style="text-align:center; color:#888;">Fetching file list...</div>
            </div>

            <div style="padding:15px; border-top:1px solid #333; display:flex; justify-content:flex-end; gap:10px;">
                <button id="asmr-modal-cancel" style="padding:8px 16px; background:#333; border:none; color:white; border-radius:4px; cursor:pointer;">Cancel</button>
                <button id="asmr-modal-download" style="padding:8px 24px; background:#e91e63; border:none; color:white; border-radius:4px; cursor:pointer; font-weight:bold;">Download Selected</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Bind Close/Cancel
    const close = () => modal.remove();
    modal.querySelector('#asmr-modal-close').onclick = close;
    modal.querySelector('#asmr-modal-cancel').onclick = close;

    console.log(`[ASMR-DL] Sending GET_TRACKS for ${rjCode}`);

    // Timeout handling
    const timeoutId = setTimeout(() => {
        const tree = modal.querySelector('#asmr-modal-tree');
        if (tree && tree.textContent.includes('Fetching')) {
            tree.innerHTML = `<div style="color:#e91e63; text-align:center;">Request timed out.<br>Check console for errors.</div>`;
        }
    }, 10000); // 10s timeout

    // Fetch Data
    chrome.runtime.sendMessage({ type: 'GET_TRACKS', rjCode }, (response) => {
        clearTimeout(timeoutId);
        console.log(`[ASMR-DL] Received GET_TRACKS response`, response);

        if (chrome.runtime.lastError) {
            console.error("[ASMR-DL] Runtime Error:", chrome.runtime.lastError);
            modal.querySelector('#asmr-modal-tree').innerHTML = `<div style="color:red; text-align:center;">Communication Error:<br>${chrome.runtime.lastError.message}</div>`;
            return;
        }

        if (!response) {
            modal.querySelector('#asmr-modal-tree').innerHTML = `<div style="color:red; text-align:center;">Empty Response</div>`;
            return;
        }

        if (response.error) {
            modal.querySelector('#asmr-modal-tree').innerHTML = `<div style="color:red; text-align:center;">Error: ${response.error}</div>`;
            return;
        }
        renderSelectionTree(response.data, rjCode, modal);
    });
}

function renderSelectionTree(data, rjCode, modal) {
    const treeContainer = modal.querySelector('#asmr-modal-tree');
    treeContainer.innerHTML = '';

    // 1. Flatten for Extension Analysis & Collection
    const allFiles = [];
    const extensionCounts = {};

    // Recursive rendering
    function buildNode(node, path, level) {
        const div = document.createElement('div');
        div.style.paddingLeft = (level * 20) + 'px';

        if (node.type === 'folder') {
            div.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <span class="asmr-folder-toggle" style="cursor:pointer; font-family:monospace; margin-right:5px; color:#aaa; user-select:none;">[-]</span>
                    <input type="checkbox" checked class="asmr-folder-cb" data-path="${path}/${node.title}">
                    <span style="margin-left:6px; color:#e0c068; cursor:pointer;" class="asmr-folder-name">📁 ${node.title}</span>
                </div>
            `;
            const container = document.createElement('div');
            container.style.display = 'block'; // Default expanded

            // Folder checkbox logic
            const cb = div.querySelector('.asmr-folder-cb');
            cb.onchange = (e) => {
                container.querySelectorAll('input').forEach(c => c.checked = e.target.checked);
                updateButtonState();
            };

            // Folder toggle logic
            const toggleFn = () => {
                const toggleBtn = div.querySelector('.asmr-folder-toggle');
                if (container.style.display === 'none') {
                    container.style.display = 'block';
                    toggleBtn.textContent = '[-]';
                } else {
                    container.style.display = 'none';
                    toggleBtn.textContent = '[+]';
                }
            };

            div.querySelector('.asmr-folder-toggle').onclick = toggleFn;
            div.querySelector('.asmr-folder-name').onclick = toggleFn;

            if (node.children) {
                node.children.forEach(child => {
                    const childNode = buildNode(child, path ? `${path}/${node.title}` : node.title, level + 1);
                    container.appendChild(childNode);
                });
            }
            div.appendChild(container);
        } else {
            // File
            const fullPath = path ? `${path}/${node.title}` : node.title;
            const ext = node.title.split('.').pop().toLowerCase();

            if (!extensionCounts[ext]) extensionCounts[ext] = 0;
            extensionCounts[ext]++;

            allFiles.push({
                path: `${rjCode}/${fullPath}`,
                url: node.mediaDownloadUrl,
                element: null // will fill below
            });

            div.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <input type="checkbox" checked class="asmr-file-cb" data-ext="${ext}" data-url="${node.mediaDownloadUrl}" data-path="${rjCode}/${fullPath}">
                    <span style="margin-left:6px;">📄 ${node.title}</span>
                </div>
             `;
        }
        return div;
    }

    // Build Tree
    data.forEach(node => {
        treeContainer.appendChild(buildNode(node, "", 0));
    });

    // Helper to update button state
    const updateButtonState = () => {
        const count = modal.querySelectorAll('.asmr-file-cb:checked').length;
        const btn = modal.querySelector('#asmr-modal-download');
        if (count === 0) {
            btn.disabled = true;
            btn.style.backgroundColor = '#555';
            btn.style.cursor = 'not-allowed';
            btn.textContent = 'Select files';
        } else {
            btn.disabled = false;
            btn.style.backgroundColor = '#e91e63';
            btn.style.cursor = 'pointer';
            btn.textContent = `Download Selected (${count})`;
        }
    };

    // 2. Render Filters
    const filterContainer = modal.querySelector('#asmr-modal-filters');
    filterContainer.innerHTML = '';

    // Add "Select All" / "None"
    const allBtn = document.createElement('button');
    allBtn.textContent = 'All';
    allBtn.style.cssText = "background:#333; color:white; border:1px solid #555; padding:2px 8px; cursor:pointer;";
    allBtn.onclick = () => {
        modal.querySelectorAll('input').forEach(i => i.checked = true);
        updateButtonState();
    };
    filterContainer.appendChild(allBtn);

    const noneBtn = document.createElement('button');
    noneBtn.textContent = 'None';
    noneBtn.style.cssText = "background:#333; color:white; border:1px solid #555; padding:2px 8px; cursor:pointer;";
    noneBtn.onclick = () => {
        modal.querySelectorAll('input').forEach(i => i.checked = false);
        updateButtonState();
    };
    filterContainer.appendChild(noneBtn);

    Object.keys(extensionCounts).forEach(ext => {
        const btn = document.createElement('button');
        btn.textContent = `.${ext} (${extensionCounts[ext]})`;
        btn.style.cssText = "background:#333; color:white; border:1px solid #555; padding:2px 8px; cursor:pointer; margin-left:4px;";

        btn.onclick = () => {
            // Toggle logic: If any unchecked, check all. If all checked, uncheck all.
            const checkboxes = Array.from(modal.querySelectorAll(`.asmr-file-cb[data-ext="${ext}"]`));
            const allChecked = checkboxes.every(cb => cb.checked);
            checkboxes.forEach(cb => cb.checked = !allChecked);
            updateButtonState();
        };

        filterContainer.appendChild(btn);
    });

    // Bind change events for individual checkboxes
    modal.querySelectorAll('input').forEach(cb => {
        cb.addEventListener('change', updateButtonState);
    });

    // Initial state check
    updateButtonState();

    // 3. Handle Download
    modal.querySelector('#asmr-modal-download').onclick = () => {
        const selectedRecipes = [];
        modal.querySelectorAll('.asmr-file-cb:checked').forEach(cb => {
            selectedRecipes.push({
                url: cb.getAttribute('data-url'),
                path: cb.getAttribute('data-path')
            });
        });

        if (selectedRecipes.length === 0) return; // Should be disabled anyway

        console.log(`[ASMR-DL] Selected ${selectedRecipes.length} files`);
        chrome.runtime.sendMessage({
            type: 'ADD_TO_QUEUE',
            rjCode,
            files: selectedRecipes
        }, (response) => {
            if (response && response.queue) renderQueue(response.queue);
        });

        modal.remove();
        showWidget();
    };
}
