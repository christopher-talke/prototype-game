/**
 * Editor entry point. Mounts `EditorApp` against the DOM skeleton in
 * `editor.html`.
 *
 * Part of the editor layer.
 */

import './panels/panelLayout.css';

import { EditorApp } from './app/EditorApp';

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('editor-root');
    const topbar = document.getElementById('editor-topbar');
    const toolOptions = document.getElementById('editor-tool-options');
    const left = document.getElementById('editor-left');
    const right = document.getElementById('editor-right');
    const viewport = document.getElementById('editor-viewport');
    const bottom = document.getElementById('editor-bottom');

    if (!root || !topbar || !toolOptions || !left || !right || !viewport || !bottom) {
        throw new Error('Editor DOM skeleton missing required containers.');
    }

    const app = new EditorApp({ root, topbar, toolOptions, left, right, viewport, bottom });
    void app.init();
});
