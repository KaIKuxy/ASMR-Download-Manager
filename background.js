
// Background Service Worker

const MAX_CONCURRENT_DOWNLOADS = 3;
let activeDownloads = 0;
let downloadQueue = [];
let downloadRoot = "ASMR"; // Default folder

// Initialize queue and settings from storage
chrome.storage.local.get(['downloadQueue', 'downloadRoot'], (result) => {
    if (result.downloadQueue) {
        downloadQueue = result.downloadQueue;
        // Reset any 'downloading' status to 'pending' on startup
        downloadQueue.forEach(item => {
            if (item.status === 'downloading') {
                item.status = 'pending';
                item.files.forEach(f => {
                    if (f.status === 'downloading') f.status = 'pending';
                });
            }
        });
        saveQueue();
    }
    if (result.downloadRoot !== undefined) {
        downloadRoot = result.downloadRoot;
    }
});

function saveQueue() {
    chrome.storage.local.set({ downloadQueue, downloadRoot });
    broadcastUpdate();
}

function broadcastUpdate() {
    console.log("Broadcasting Queue Update", downloadQueue.length);

    // 1. Send to Popup (if open)
    chrome.runtime.sendMessage({
        type: 'QUEUE_UPDATE',
        queue: downloadQueue
    }).catch(() => { /* Popup closed, ignore */ });

    // 2. Send to Content Scripts
    chrome.tabs.query({ url: ["*://asmr.one/*", "*://www.asmr.one/*"] }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'QUEUE_UPDATE',
                queue: downloadQueue
            }).catch((err) => {
                console.log(`Failed to send to tab ${tab.id}:`, err);
            });
        });
    });
}

// Listen for messages from Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ADD_TO_QUEUE') {
        handleAddToQueue(message.rjCode, message.files).then(() => sendResponse({ queue: downloadQueue }));
    } else if (message.type === 'PAUSE_ITEM') {
        toggleItemStatus(message.rjCode, 'paused');
        sendResponse({ queue: downloadQueue });
    } else if (message.type === 'RESUME_ITEM') {
        toggleItemStatus(message.rjCode, 'pending');
        processQueue();
        sendResponse({ queue: downloadQueue });
    } else if (message.type === 'CANCEL_ITEM') {
        removeItem(message.rjCode);
        sendResponse({ queue: downloadQueue });
    } else if (message.type === 'CLEAR_COMPLETED') {
        clearCompleted();
        sendResponse({ queue: downloadQueue });
    } else if (message.type === 'RETRY_ITEM') {
        retryItem(message.rjCode);
        sendResponse({ queue: downloadQueue });
    } else if (message.type === 'GET_TRACKS') {
        handleGetTracks(message.rjCode).then(data => sendResponse(data));
    } else if (message.type === 'GET_QUEUE') {
        sendResponse({ queue: downloadQueue, root: downloadRoot });
    } else if (message.type === 'UPDATE_SETTINGS') {
        let raw = message.root || "";
        // 1. Normalize slashes
        raw = raw.replace(/\\/g, '/');
        // 2. Remove illegal characters for Windows/Linux filenames (excluding /)
        // < > : " | ? *
        raw = raw.replace(/[<>:"|?*]/g, '');
        // 3. Prevent directory traversal
        raw = raw.replace(/\.\./g, '');
        // 4. Remove leading/trailing slashes and duplicate slashes
        raw = raw.split('/').filter(s => s.trim().length > 0).join('/');

        downloadRoot = raw;
        saveQueue();
        sendResponse({ success: true, root: downloadRoot });
    }
    return true; // Keep channel open for async response
});

function retryItem(rjCode) {
    const item = downloadQueue.find(i => i.rjCode === rjCode);
    if (item) {
        // Reset item status
        item.status = 'pending';

        // Reset failed files
        item.files.forEach(f => {
            if (f.status === 'error') {
                f.status = 'pending';
            }
        });
        saveQueue();
        processQueue();
    }
}

function clearCompleted() {
    downloadQueue = downloadQueue.filter(item => item.status !== 'completed');
    saveQueue();
}

async function handleGetTracks(rjCode) {
    const internalId = parseInt(rjCode.replace("RJ", ""), 10);
    if (isNaN(internalId)) return { error: "Invalid Code" };
    try {
        const trackData = await fetchTrackList(internalId);
        return { data: trackData };
    } catch (e) {
        return { error: e.message };
    }
}

async function handleAddToQueue(rjCode, selectedFiles = null) {
    // Check if exists
    if (downloadQueue.find(i => i.rjCode === rjCode)) return;

    const internalId = parseInt(rjCode.replace("RJ", ""), 10);
    if (isNaN(internalId)) {
        console.error("Invalid RJ Code:", rjCode);
        return;
    }

    // Add placeholder to queue
    const queueItem = {
        rjCode,
        status: 'fetching_info',
        progress: 0,
        totalFiles: 0,
        completedFiles: 0,
        files: []
    };
    downloadQueue.push(queueItem);
    saveQueue();

    try {
        if (selectedFiles) {
            // User provided specific files
            queueItem.files = selectedFiles.map(f => ({ ...f, status: 'pending' }));
        } else {
            // Default: Fetch all
            const trackData = await fetchTrackList(internalId);
            queueItem.files = parseTracks(trackData, rjCode);
        }

        queueItem.totalFiles = queueItem.files.length;
        queueItem.status = 'pending';
        saveQueue();
        processQueue();
    } catch (err) {
        console.error("Failed to fetch info", err);
        queueItem.status = 'error';
        saveQueue();
    }
}

function fetchTrackList(internalId) {
    return fetch(`https://api.asmr-200.com/api/tracks/${internalId}`)
        .then(res => {
            if (!res.ok) throw new Error("API Error");
            return res.json();
        });
}

function parseTracks(nodes, rootPath) {
    let files = [];

    function traverse(node, currentPath) {
        if (node.type === 'folder') {
            const newPath = currentPath ? `${currentPath}/${node.title}` : node.title;
            if (node.children) {
                node.children.forEach(child => traverse(child, newPath));
            }
        } else {
            // It's a file
            if (node.mediaDownloadUrl) {
                files.push({
                    url: node.mediaDownloadUrl,
                    path: `${rootPath}/${currentPath}/${node.title}`, // e.g. RJ123456/Bonus/01.mp3
                    status: 'pending'
                });
            }
        }
    }

    nodes.forEach(node => traverse(node, ""));
    return files;
}

function toggleItemStatus(rjCode, status) {
    const item = downloadQueue.find(i => i.rjCode === rjCode);
    if (item) {
        item.status = status;
        saveQueue();
    }
}

function removeItem(rjCode) {
    downloadQueue = downloadQueue.filter(i => i.rjCode !== rjCode);
    saveQueue();
}

// Download Processing Loop
async function processQueue() {
    if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) return;

    // Find a file to download
    // We prioritize files in 'downloading' items, then 'pending' items

    for (const item of downloadQueue) {
        if (item.status === 'pending' || item.status === 'downloading') {
            if (item.status === 'pending') {
                item.status = 'downloading';
                saveQueue();
            }

            for (const file of item.files) {
                if (file.status === 'pending') {
                    if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) return;

                    startFileDownload(item, file);
                }
            }
        }
    }
}

function startFileDownload(item, file) {
    activeDownloads++;
    file.status = 'downloading';
    saveQueue();

    chrome.downloads.download({
        url: file.url,
        filename: downloadRoot ? `${downloadRoot}/${file.path}` : file.path,
        conflictAction: 'overwrite',
        saveAs: false
    }, (downloadId) => {
        if (chrome.runtime.lastError) {
            console.error("Download failed to start", chrome.runtime.lastError);
            file.status = 'error';
            activeDownloads--;
            saveQueue();
            processQueue();
        } else {
            // We don't track the ID for now, simpler to just rely on "done"
            // But actually we need to know when *this specific file* finishes to decrement activeDownloads
            file.downloadId = downloadId;
        }
    });
}

chrome.downloads.onChanged.addListener(async (delta) => {
    console.log("Download Event:", delta);

    // Check if we know this ID
    let known = false;
    for (const item of downloadQueue) {
        if (item.files.find(f => f.downloadId === delta.id)) {
            known = true;
            break;
        }
    }

    if (known) {
        if (delta.state && delta.state.current === 'complete') {
            handleDownloadComplete(delta.id, true);
        } else if (delta.state && delta.state.current === 'interrupted') {
            // If user cancels manually, we mark error
            handleDownloadComplete(delta.id, false);
        }
    } else {
        // Unknown ID: Check if it's a "Retry" of one of our files
        if (delta.state) {
            recoverOrphanedDownload(delta.id);
        }
    }
});

async function recoverOrphanedDownload(id) {
    try {
        const [downloadItem] = await chrome.downloads.search({ id });
        if (!downloadItem || !downloadItem.url) return;

        // Look for a matching file in our queue that is NOT completed
        for (const item of downloadQueue) {
            const file = item.files.find(f => f.url === downloadItem.url && f.status !== 'completed');
            if (file) {
                console.log(`[Recovery] Found orphaned download ${id} matching file ${file.path}`);

                // Adopt the new ID
                file.downloadId = id;
                file.status = 'downloading'; // Assume downloading if we found it alive

                if (downloadItem.state === 'complete') {
                    file.status = 'completed';
                    item.completedFiles++;
                } else if (downloadItem.state === 'interrupted') {
                    file.status = 'error';
                }

                // Update active downloads count if needed (tricky, let's just reset/recalc or rely on processQueue to fix eventually)
                // Safer to trust processQueue logic, but we need to ensure we don't double count.
                // For now, just saving state is good enough to prevent "Stuck" UI.

                saveQueue();

                // If it finished instantly
                if (downloadItem.state === 'complete') {
                    handleDownloadComplete(id, true);
                }
                break;
            }
        }
    } catch (e) {
        console.error("Recovery failed", e);
    }
}

function handleDownloadComplete(downloadId, success) {
    console.log(`Checking completion for ID: ${downloadId}, Success: ${success}`);

    // Find the file in our queue
    let Found = false;
    for (const item of downloadQueue) {
        // We use loose equality or strict? downloadId is number.
        const file = item.files.find(f => f.downloadId === downloadId);
        if (file) {
            console.log(`Found file: ${file.path}`);
            activeDownloads--;
            file.status = success ? 'completed' : 'error';
            if (success) item.completedFiles++;

            // Update item progress
            item.progress = Math.floor((item.completedFiles / item.totalFiles) * 100);

            // Check if all files processed (success or error)
            const processedFiles = item.files.filter(f => f.status === 'completed' || f.status === 'error').length;
            if (processedFiles === item.totalFiles) {
                // Determine final status
                if (item.completedFiles === item.totalFiles) {
                    item.status = 'completed';
                } else {
                    item.status = 'error'; // Partial completion
                }
            }

            saveQueue();
            Found = true;
            break;
        }
    }

    if (Found) {
        processQueue();
    } else {
        console.warn(`Download ID ${downloadId} not found in queue.`);
        // Race condition fallback: maybe the callback hasn't fired yet? 
        // In a real app we might want to queue this event or use a lookup map pre-assigned.
    }
}

