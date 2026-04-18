/**
 * Editor tool interface.
 *
 * One tool is active at a time; the ToolManager forwards pointer/key events
 * to it. Tools own their own ephemeral state (in-flight drag, modifier
 * tracking) but never mutate EditorWorkingState directly -- they dispatch
 * commands to CommandStack.
 *
 * Part of the editor layer.
 */

export interface ToolPointerEvent {
    /** Native PointerEvent. */
    native: PointerEvent;
    /** Pointer X in world coordinates (camera-relative). */
    worldX: number;
    /** Pointer Y in world coordinates. */
    worldY: number;
    /** Pointer X in screen coords (relative to canvas top-left). */
    screenX: number;
    /** Pointer Y in screen coords. */
    screenY: number;
}

export interface ToolKeyEvent {
    native: KeyboardEvent;
}

export interface Tool {
    readonly id: string;
    readonly cursor: string;
    activate(args?: unknown): void;
    deactivate(): void;
    onPointerDown?(e: ToolPointerEvent): void;
    onPointerMove?(e: ToolPointerEvent): void;
    onPointerUp?(e: ToolPointerEvent): void;
    onKeyDown?(e: ToolKeyEvent): void;
    onContextMenu?(e: ToolPointerEvent): void;
}
