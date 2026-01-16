
// Popup Script
function render(queue) {
    const container = document.getElementById('queue');
    if (!queue || queue.length === 0) {
        container.innerHTML = '<div style="color:#888;text-align:center;">No downloads queued</div>';
        return;
    }

    container.innerHTML = '';
    queue.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item';
        let status = item.status;
        if (status === 'downloading') {
            status = `${item.progress}%`;
        }

        div.innerHTML = `
      <div class="header">
        <span>${item.rjCode}</span>
        <span>${status}</span>
      </div>
      <div class="progress">
        <div class="fill" style="width: ${item.progress}%"></div>
      </div>
    `;
        container.appendChild(div);
    });
}

// Get initial
chrome.runtime.sendMessage({ type: 'GET_QUEUE' }, (response) => {
    if (response && response.queue) render(response.queue);
});

// Listen for updates
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'QUEUE_UPDATE') {
        render(message.queue);
    }
});
