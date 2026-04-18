/**
 * Per-mapId sprite asset loader cache for editor renderers.
 *
 * Loads textures via PixiJS Assets, deduplicating by URL. Resolves URLs
 * relative to `/maps/{mapId}/`. A loaded-event listener fires per texture so
 * incremental renders can refresh as sprites become available.
 *
 * Part of the editor layer.
 */

import { Assets, Texture } from 'pixi.js';

type Listener = (url: string, tex: Texture) => void;

export class SpriteCache {
    private mapId: string;
    private cache = new Map<string, Texture>();
    private inflight = new Map<string, Promise<Texture>>();
    private listeners = new Set<Listener>();

    constructor(mapId: string) {
        this.mapId = mapId;
    }

    setMapId(mapId: string): void {
        if (this.mapId === mapId) return;
        this.mapId = mapId;
        this.cache.clear();
        this.inflight.clear();
    }

    /** Synchronous lookup. Returns undefined if not yet loaded. */
    get(assetPath: string): Texture | undefined {
        return this.cache.get(this.urlFor(assetPath));
    }

    /** Begin loading a texture. Resolves with the Texture; subsequent calls are deduped. */
    load(assetPath: string): Promise<Texture> {
        const url = this.urlFor(assetPath);
        const cached = this.cache.get(url);
        if (cached) return Promise.resolve(cached);
        const inflight = this.inflight.get(url);
        if (inflight) return inflight;

        const p = Assets.load<Texture>(url)
            .then((tex) => {
                this.cache.set(url, tex);
                this.inflight.delete(url);
                for (const l of this.listeners) l(url, tex);
                return tex;
            })
            .catch((err) => {
                this.inflight.delete(url);
                throw err;
            });
        this.inflight.set(url, p);
        return p;
    }

    onLoaded(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private urlFor(assetPath: string): string {
        if (assetPath.startsWith('/') || assetPath.startsWith('http')) return assetPath;
        return `/maps/${this.mapId}/${assetPath}`;
    }
}
