
import React, { useState, useRef, useEffect } from 'react';

export default function FloatingWidget({ queue, downloadRoot, setDownloadRoot }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 }); // Transform offset from bottom-right?
    // Actually original was fixed bottom-right. Dragging used simple translate.

    // Dragging Logic
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const currentTranslate = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - currentTranslate.current.x,
            y: e.clientY - currentTranslate.current.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.clientX - dragStartPos.current.x;
            const y = e.clientY - dragStartPos.current.y;
            currentTranslate.current = { x, y };
            setPosition({ x, y });
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const handleClear = (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: 'CLEAR_COMPLETED' });
    };

    const handleSettingsSave = () => {
        const input = document.getElementById('asmr-react-root-input');
        if (input) {
            chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', root: input.value }, (res) => {
                if (res && res.success) {
                    setDownloadRoot(res.root);
                    setShowSettings(false);
                }
            });
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '300px',
            backgroundColor: '#1d1d1d',
            color: '#fff',
            border: '2px solid #555',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
            zIndex: 999999, // High z-index for widget
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '400px',
            transform: `translate3d(${position.x}px, ${position.y}px, 0)`
        }}>
            {/* Header */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    padding: '10px',
                    backgroundColor: '#2d2d2d',
                    borderBottom: '1px solid #333',
                    cursor: 'move',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <span style={{ fontWeight: 'bold' }}>Download Manager</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                        style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '14px' }}
                        title="Settings"
                    >
                        ⚙️
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                    >
                        –
                    </button>
                </div>
            </div>

            {/* Content Body */}
            <div style={{ display: isExpanded ? 'block' : 'none' }}>

                {/* Settings Panel */}
                {showSettings ? (
                    <div style={{ padding: '10px', background: '#222', borderBottom: '1px solid #333' }}>
                        <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>Download Folder:</label>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input
                                id="asmr-react-root-input"
                                type="text"
                                defaultValue={downloadRoot}
                                placeholder="e.g. ASMR"
                                style={{ flex: 1, background: '#333', border: '1px solid #555', color: 'white', padding: '4px', borderRadius: '4px' }}
                            />
                            <button
                                onClick={handleSettingsSave}
                                style={{ background: '#e91e63', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Save
                            </button>
                        </div>
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>Relative to Downloads folder</div>
                    </div>
                ) : null}

                {/* Queue List */}
                <div style={{ overflowY: 'auto', padding: '10px', maxHeight: '300px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '5px' }}>
                        <span style={{ fontSize: '12px', color: '#888' }}>Queue</span>
                        <button
                            onClick={handleClear}
                            style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
                        >
                            Clear Finished
                        </button>
                    </div>

                    {queue.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#888', padding: '10px' }}>Queue empty</div>
                    ) : (
                        queue.map(item => <QueueItem key={item.rjCode} item={item} />)
                    )}
                </div>
            </div>
        </div>
    );
}

function QueueItem({ item }) {
    const handleAction = (action) => {
        chrome.runtime.sendMessage({ type: `${action.toUpperCase()}_ITEM`, rjCode: item.rjCode });
    };

    let statusText = item.status;
    if (item.status === 'downloading') {
        statusText = `${item.progress}% (${item.completedFiles}/${item.totalFiles})`;
    } else if (item.status === 'pending') statusText = 'Pending...';
    else if (item.status === 'fetching_info') statusText = 'Fetching Info...';

    return (
        <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#262626', borderRadius: '4px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 'bold' }}>{item.rjCode}</span>
                <span>{statusText}</span>
            </div>
            <div style={{ height: '4px', backgroundColor: '#444', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${item.progress}%`, height: '100%', backgroundColor: '#e91e63', transition: 'width 0.3s' }}></div>
            </div>
            <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                {(item.status === 'downloading' || item.status === 'pending') && (
                    <button onClick={() => handleAction('pause')} style={btnStyle}>⏸ Pause</button>
                )}
                {item.status === 'paused' && (
                    <button onClick={() => handleAction('resume')} style={btnStyle}>▶ Resume</button>
                )}
                {item.status === 'error' && (
                    <button onClick={() => handleAction('retry')} style={{ ...btnStyle, color: '#ffa726' }}>↻ Retry</button>
                )}
                {item.status !== 'completed' ? (
                    <button onClick={() => handleAction('cancel')} style={btnStyle}>✖ Cancel</button>
                ) : (
                    <span style={{ color: '#4caf50' }}>✔ Done</span>
                )}
            </div>
        </div>
    );
}

const btnStyle = { background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' };
