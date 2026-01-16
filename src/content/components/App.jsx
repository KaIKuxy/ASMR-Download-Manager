
import React, { useState, useEffect } from 'react';
import FloatingWidget from './FloatingWidget';
import SelectionModal from './SelectionModal';
import { startInjector, updateButtonStyles } from '../utils/injector';

export default function App() {
    const [queue, setQueue] = useState([]);
    const [downloadRoot, setDownloadRoot] = useState("ASMR");
    const [modalRjCode, setModalRjCode] = useState(null);

    // Initial Load & Injection
    useEffect(() => {
        startInjector();

        // Initial Fetch
        chrome.runtime.sendMessage({ type: 'GET_QUEUE' }, (response) => {
            if (response) {
                if (response.queue) setQueue(response.queue);
                if (response.root) setDownloadRoot(response.root);
            }
        });

        // Message Listener
        const msgListener = (message) => {
            if (message.type === 'QUEUE_UPDATE') {
                setQueue(message.queue);
            }
        };
        chrome.runtime.onMessage.addListener(msgListener);

        // Custom Event Listener (from DL buttons)
        const dlRequestListener = (e) => {
            console.log("DL Request Received", e.detail);
            setModalRjCode(e.detail.rjCode);
        };
        window.addEventListener('asmr-dl-request', dlRequestListener);

        return () => {
            chrome.runtime.onMessage.removeListener(msgListener);
            window.removeEventListener('asmr-dl-request', dlRequestListener);
        };
    }, []);

    // Sync Button Styles whenever queue changes
    useEffect(() => {
        updateButtonStyles(queue);
    }, [queue]);

    return (
        <div style={{ pointerEvents: 'auto', fontFamily: 'sans-serif' }}>
            <FloatingWidget
                queue={queue}
                downloadRoot={downloadRoot}
                setDownloadRoot={setDownloadRoot}
            />
            {modalRjCode ? (
                <SelectionModal
                    rjCode={modalRjCode}
                    onClose={() => setModalRjCode(null)}
                />
            ) : null}
        </div>
    );
}
