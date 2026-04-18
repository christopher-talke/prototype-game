/**
 * Pan input state machine for the editor viewport.
 *
 * Pan begins on middle-button pointerdown OR on left-button pointerdown while
 * Space is held. Pointer capture keeps the drag alive if the cursor leaves the
 * canvas. Pointer delta is passed to `camera.panByScreen`.
 *
 * Part of the editor layer.
 */

import type { EditorCamera } from './EditorCamera';

export class PanInput {
    private isDragging = false;
    private lastX = 0;
    private lastY = 0;
    private spaceHeld = false;
    private activePointerId: number | null = null;

    constructor(
        private readonly target: HTMLElement,
        private readonly camera: EditorCamera,
    ) {
        target.addEventListener('pointerdown', this.onPointerDown);
        target.addEventListener('pointermove', this.onPointerMove);
        target.addEventListener('pointerup', this.onPointerUp);
        target.addEventListener('pointercancel', this.onPointerUp);
        target.addEventListener('contextmenu', this.onContextMenu);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }

    private onKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            if (isEditableTarget(e.target)) return;
            this.spaceHeld = true;
            this.target.style.cursor = 'grab';
            if (!e.repeat) e.preventDefault();
        }
    };

    private onKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            this.spaceHeld = false;
            if (!this.isDragging) this.target.style.cursor = '';
        }
    };

    private onPointerDown = (e: PointerEvent) => {
        const isMiddle = e.button === 1;
        const isSpacePan = e.button === 0 && this.spaceHeld;
        if (!isMiddle && !isSpacePan) return;

        this.isDragging = true;
        this.activePointerId = e.pointerId;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.target.setPointerCapture(e.pointerId);
        this.target.style.cursor = 'grabbing';
        e.preventDefault();
    };

    private onPointerMove = (e: PointerEvent) => {
        if (!this.isDragging || e.pointerId !== this.activePointerId) return;
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.camera.panByScreen(dx, dy);
    };

    private onPointerUp = (e: PointerEvent) => {
        if (e.pointerId !== this.activePointerId) return;
        this.isDragging = false;
        this.activePointerId = null;
        if (this.target.hasPointerCapture(e.pointerId)) {
            this.target.releasePointerCapture(e.pointerId);
        }
        this.target.style.cursor = this.spaceHeld ? 'grab' : '';
    };

    private onContextMenu = (e: MouseEvent) => {
        e.preventDefault();
    };
}

function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return target.isContentEditable;
}
