/**
 * Routes pointer / keyboard events to the currently active editor tool.
 *
 * Owns a registry of tools (id → Tool) and a single active tool pointer.
 * Activation calls Tool.activate(args); the previous tool's deactivate()
 * is called first. Listeners are notified on every tool change so the
 * tool palette UI can highlight the active button.
 *
 * Part of the editor layer.
 */

import type { Tool, ToolPointerEvent, ToolKeyEvent } from './tool';

type Listener = (toolId: string) => void;

export class ToolManager {
    private tools = new Map<string, Tool>();
    private activeId: string = '';
    private listeners = new Set<Listener>();
    private container: HTMLElement | null = null;

    setCursorTarget(container: HTMLElement): void {
        this.container = container;
    }

    register(tool: Tool): void {
        this.tools.set(tool.id, tool);
    }

    activate(id: string, args?: unknown): void {
        if (this.activeId === id && args === undefined) return;
        const previous = this.tools.get(this.activeId);
        previous?.deactivate();
        const next = this.tools.get(id);
        if (!next) return;
        this.activeId = id;
        next.activate(args);
        if (this.container) this.container.style.cursor = next.cursor;
        for (const l of this.listeners) l(id);
    }

    activeToolId(): string {
        return this.activeId;
    }

    activeTool(): Tool | null {
        return this.tools.get(this.activeId) ?? null;
    }

    onPointerDown(e: ToolPointerEvent): void {
        this.activeTool()?.onPointerDown?.(e);
    }

    onPointerMove(e: ToolPointerEvent): void {
        this.activeTool()?.onPointerMove?.(e);
    }

    onPointerUp(e: ToolPointerEvent): void {
        this.activeTool()?.onPointerUp?.(e);
    }

    onKeyDown(e: ToolKeyEvent): void {
        this.activeTool()?.onKeyDown?.(e);
    }

    onContextMenu(e: ToolPointerEvent): void {
        this.activeTool()?.onContextMenu?.(e);
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
