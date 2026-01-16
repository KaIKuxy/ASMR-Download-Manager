
import React, { useState, useEffect, useMemo, useRef } from 'react';

// Helper to get selection state of a node (recursive)
function getSelectionState(node, selectedUrls, rjCode, pathPrefix) {
    if (node.mediaDownloadUrl) {
        // It's a file
        return selectedUrls.has(node.mediaDownloadUrl) ? 'checked' : 'unchecked';
    } else if (node.type === 'folder' && node.children) {
        let allChecked = true;
        let noneChecked = true;

        // We need to traverse children to see their state
        const traverse = (n, currentPrefix) => {
            const full = currentPrefix ? `${currentPrefix}/${n.title}` : n.title;
            if (n.mediaDownloadUrl) {
                if (selectedUrls.has(n.mediaDownloadUrl)) noneChecked = false;
                else allChecked = false;
            } else if (n.type === 'folder' && n.children) {
                n.children.forEach(c => traverse(c, full));
            }
        };

        // Start traversal from this node's children
        const myFullPath = pathPrefix ? `${pathPrefix}/${node.title}` : node.title;
        node.children.forEach(c => traverse(c, myFullPath));

        if (allChecked) return 'checked';
        if (noneChecked) return 'unchecked';
        return 'indeterminate';
    }
    return 'unchecked';
}

export default function TreeView({ nodes, rjCode, selectedUrls, onToggleUrl, pathPrefix = "" }) {
    if (!nodes) return null;

    return (
        <div style={{ paddingLeft: '20px' }}>
            {nodes.map((node, i) => (
                <TreeNode
                    key={i}
                    node={node}
                    rjCode={rjCode}
                    pathPrefix={pathPrefix}
                    selectedUrls={selectedUrls}
                    onToggleUrl={onToggleUrl}
                />
            ))}
        </div>
    );
}

function TreeNode({ node, rjCode, pathPrefix, selectedUrls, onToggleUrl }) {
    const [expanded, setExpanded] = useState(true);
    const checkboxRef = useRef(null);
    const fullPath = pathPrefix ? `${pathPrefix}/${node.title}` : node.title;

    // Reacting to selection changes to update Indeterminate state
    const selectionState = useMemo(() => {
        return getSelectionState(node, selectedUrls, rjCode, pathPrefix);
    }, [node, selectedUrls, rjCode, pathPrefix]);

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = (selectionState === 'indeterminate');
        }
    }, [selectionState]);

    const handleFolderCheck = (e) => {
        const checked = e.target.checked;
        onToggleUrl(null, null, checked, node, pathPrefix);
    };

    if (node.type === 'folder') {
        return (
            <div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span
                        onClick={() => setExpanded(!expanded)}
                        style={{ cursor: 'pointer', fontFamily: 'monospace', marginRight: '5px', color: '#aaa', userSelect: 'none' }}
                    >
                        {expanded ? '[-]' : '[+]'}
                    </span>
                    <input
                        ref={checkboxRef}
                        type="checkbox"
                        checked={selectionState === 'checked'}
                        onChange={handleFolderCheck}
                    />
                    <span
                        onClick={() => setExpanded(!expanded)}
                        style={{ marginLeft: '6px', color: '#e0c068', cursor: 'pointer' }}
                    >
                        📁 {node.title}
                    </span>
                </div>
                {expanded && node.children ? (
                    <TreeView
                        nodes={node.children}
                        rjCode={rjCode}
                        pathPrefix={fullPath}
                        selectedUrls={selectedUrls}
                        onToggleUrl={onToggleUrl}
                    />
                ) : null}
            </div>
        );
    } else {
        // File
        const fileUrl = node.mediaDownloadUrl;
        const filePath = `${rjCode}/${fullPath}`;
        const isChecked = selectedUrls.has(fileUrl);

        return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onToggleUrl(fileUrl, filePath, e.target.checked)}
                />
                <span style={{ marginLeft: '6px' }}>📄 {node.title}</span>
            </div>
        );
    }
}
