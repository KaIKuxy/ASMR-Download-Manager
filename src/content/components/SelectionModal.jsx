
import React, { useState, useEffect, useMemo } from 'react';
import TreeView from './TreeView';

export default function SelectionModal({ rjCode, onClose }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [selectedUrls, setSelectedUrls] = useState(new Set()); // Store URLs as IDs
    const [urlToPathMap, setUrlToPathMap] = useState({}); // To retrieve paths for download

    useEffect(() => {
        let mounted = true;
        const timer = setTimeout(() => {
            if (mounted && loading) setError("Request timed out.");
        }, 10000);

        console.log(`[ASMR-DL] Fetching tracks for ${rjCode}`);
        chrome.runtime.sendMessage({ type: 'GET_TRACKS', rjCode }, (response) => {
            if (!mounted) return;
            clearTimeout(timer);
            setLoading(false);

            if (chrome.runtime.lastError) {
                setError(chrome.runtime.lastError.message);
            } else if (!response || response.error) {
                setError(response ? response.error : 'Empty Response');
            } else {
                setData(response.data);

                // Initialize selection: Select All by default
                const all = new Set();
                const map = {};

                // Flatten to find all files
                const traverse = (nodes, currentPath) => {
                    nodes.forEach(node => {
                        if (node.type === 'folder') {
                            const newPath = currentPath ? `${currentPath}/${node.title}` : node.title;
                            if (node.children) traverse(node.children, newPath);
                        } else if (node.mediaDownloadUrl) {
                            const p = `${rjCode}/${currentPath}/${node.title}`;
                            all.add(node.mediaDownloadUrl);
                            map[node.mediaDownloadUrl] = p;
                        }
                    });
                };
                traverse(response.data, "");

                setSelectedUrls(all);
                setUrlToPathMap(map);
            }
        });

        return () => { mounted = false; clearTimeout(timer); };
    }, [rjCode]);

    // Calculate Extensions for Filters
    const extensions = useMemo(() => {
        if (!data) return {};
        const extCounts = {};
        const traverse = (nodes) => {
            nodes.forEach(node => {
                if (node.type === 'folder' && node.children) traverse(node.children);
                else if (node.title) {
                    const ext = node.title.split('.').pop().toLowerCase();
                    extCounts[ext] = (extCounts[ext] || 0) + 1;
                }
            });
        };
        traverse(data);
        return extCounts;
    }, [data]);

    // Handle Toggles
    const handleToggleUrl = (url, path, checked, folderNode = null, folderPathPrefix = "") => {
        const newSet = new Set(selectedUrls);

        if (folderNode) {
            // Bulk Toggle Folder
            const traverse = (node, currentPath) => {
                const fullPath = currentPath ? `${currentPath}/${node.title}` : node.title;
                if (node.type === 'folder' && node.children) {
                    node.children.forEach(c => traverse(c, fullPath));
                } else if (node.mediaDownloadUrl) {
                    if (checked) newSet.add(node.mediaDownloadUrl);
                    else newSet.delete(node.mediaDownloadUrl);
                }
            };
            traverse(folderNode, folderPathPrefix);
        } else {
            // Single File
            if (checked) newSet.add(url);
            else newSet.delete(url);
        }
        setSelectedUrls(newSet);
    };

    const handleFilter = (ext) => {
        // Find all files with this ext and toggle them
        // Logic: if all are checked, uncheck. else check all.
        // We need list of URLs for this ext.
        const urlsForExt = [];
        const traverse = (nodes, currentPath) => { // Re-traverse isn't efficient but safe
            nodes.forEach(node => {
                if (node.type === 'folder' && node.children) {
                    traverse(node.children, currentPath ? `${currentPath}/${node.title}` : node.title);
                } else if (node.mediaDownloadUrl) {
                    const e = node.title.split('.').pop().toLowerCase();
                    if (e === ext) urlsForExt.push(node.mediaDownloadUrl);
                }
            });
        };
        traverse(data, "");

        const allChecked = urlsForExt.every(u => selectedUrls.has(u));
        const newSet = new Set(selectedUrls);
        urlsForExt.forEach(u => {
            if (allChecked) newSet.delete(u);
            else newSet.add(u);
        });
        setSelectedUrls(newSet);
    };

    const handleDownload = () => {
        const files = [];
        selectedUrls.forEach(url => {
            if (urlToPathMap[url]) {
                files.push({ url, path: urlToPathMap[url] });
            }
        });

        chrome.runtime.sendMessage({
            type: 'ADD_TO_QUEUE',
            rjCode,
            files
        }, (res) => {
            // Optional: trigger queue update immediately? App handles it via message
        });
        onClose();
    };

    if (error) {
        return (
            <Overlay>
                <div style={containerStyle}>
                    <div style={{ color: 'red', textAlign: 'center', padding: 20 }}>Error: {error}</div>
                    <button onClick={onClose} style={btnStyle}>Close</button>
                </div>
            </Overlay>
        );
    }

    return (
        <Overlay>
            <div style={containerStyle}>
                {/* Header */}
                <div style={{ padding: '15px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Download Selection: {rjCode}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                </div>

                {/* Filters */}
                <div style={{ padding: '10px', background: '#1a1a1a', display: 'flex', gap: '10px', flexWrap: 'wrap', borderBottom: '1px solid #333' }}>
                    <button onClick={() => {
                        // Select All
                        const all = new Set();
                        Object.keys(urlToPathMap).forEach(u => all.add(u));
                        setSelectedUrls(all);
                    }} style={filterBtnStyle}>All</button>
                    <button onClick={() => setSelectedUrls(new Set())} style={filterBtnStyle}>None</button>

                    {Object.keys(extensions).map(ext => (
                        <button key={ext} onClick={() => handleFilter(ext)} style={filterBtnStyle}>.{ext} ({extensions[ext]})</button>
                    ))}
                </div>

                {/* Tree */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '15px', fontSize: '13px', lineHeight: '1.5' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', color: '#888' }}>Fetching file list...</div>
                    ) : (
                        <TreeView
                            nodes={data}
                            rjCode={rjCode}
                            selectedUrls={selectedUrls}
                            onToggleUrl={handleToggleUrl}
                        />
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '15px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', background: '#333', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                    <button
                        onClick={handleDownload}
                        disabled={selectedUrls.size === 0}
                        style={{
                            padding: '8px 24px',
                            background: selectedUrls.size === 0 ? '#555' : '#e91e63',
                            border: 'none',
                            color: 'white',
                            borderRadius: '4px',
                            cursor: selectedUrls.size === 0 ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        {selectedUrls.size === 0 ? 'Select files' : `Download Selected (${selectedUrls.size})`}
                    </button>
                </div>
            </div>
        </Overlay>
    );
}

function Overlay({ children }) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2147483647,
            display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif'
        }}>
            {children}
        </div>
    );
}

const containerStyle = {
    background: '#222', width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
    borderRadius: '8px', border: '1px solid #444', color: 'white'
};

const btnStyle = { padding: '8px 16px', background: '#333', border: 'none', color: 'white', cursor: 'pointer' };

const filterBtnStyle = {
    background: '#333', color: 'white', border: '1px solid #555', padding: '2px 8px', cursor: 'pointer'
};
