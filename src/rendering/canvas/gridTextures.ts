/**
 * Grid-deformable texture layer system.
 *
 * Loads texture images defined in a map's layer definitions and renders them
 * as deformable meshes whose vertices are tied to the grid displacement system.
 * Supports two UV modes: "cover" (stretch to world bounds) and "tile" (repeating).
 * Each mesh is placed either below or above the grid dots layer.
 *
 * Part of the canvas rendering layer.
 */

import { Assets, Geometry, Mesh, Texture, type Container } from 'pixi.js';

import { getGridGeometry, isGridSettled } from './gridDisplacement';
import { gridTexturesBelowLayer, gridTexturesAboveLayer } from './sceneGraph';

interface ActiveMesh {
    mesh: Mesh;
    container: Container;
}

const activeMeshes: ActiveMesh[] = [];
let synced = false;

/**
 * Load texture layers for a map and build deformable meshes on the grid topology.
 * Replaces any previously loaded textures.
 * @param mapId - Map identifier used to resolve texture asset paths.
 * @param layers - Texture layer definitions from the map data.
 */
export async function initGridTextures(mapId: string, layers?: TextureLayerDef[]): Promise<void> {
    clearGridTextures();
    if (!layers || layers.length === 0) return;

    const grid = getGridGeometry();
    if (!grid.displaceX || grid.cols === 0) return;

    const { cols, rows, spacing } = grid;
    const worldWidth = (cols + 1) * spacing;
    const worldHeight = (rows + 1) * spacing;

    // Build shared index buffer (same topology for all layers)
    const cellCols = cols - 1;
    const cellRows = rows - 1;
    const indices = new Uint32Array(cellCols * cellRows * 6);
    let idx = 0;
    for (let r = 0; r < cellRows; r++) {
        for (let c = 0; c < cellCols; c++) {
            const tl = r * cols + c;
            const tr = tl + 1;
            const bl = tl + cols;
            const br = bl + 1;
            indices[idx++] = tl;
            indices[idx++] = tr;
            indices[idx++] = bl;
            indices[idx++] = tr;
            indices[idx++] = br;
            indices[idx++] = bl;
        }
    }

    const positions = buildRestPositions(cols, rows, spacing);

    for (const layer of layers) {
        const url = `/maps/${mapId}/${layer.src}`;
        let texture: Texture;
        try {
            texture = await Assets.load<Texture>(url);
        } catch {
            console.warn(`gridTextures: failed to load ${url}`);
            continue;
        }

        if (layer.mode === 'tile') {
            texture.source.style.addressModeU = 'repeat';
            texture.source.style.addressModeV = 'repeat';
            texture.source.style.update();
        }

        const uvs = buildUVs(cols, rows, spacing, worldWidth, worldHeight, layer);

        const geometry = new Geometry({
            attributes: {
                aPosition: new Float32Array(positions),
                aUV: uvs,
            },
            indexBuffer: new Uint32Array(indices),
        });

        const mesh = new Mesh({ geometry: geometry as any, texture });
        mesh.alpha = layer.opacity ?? 1;
        mesh.tint = layer.tint ?? 0xffffff;
        if (layer.blendMode) mesh.blendMode = layer.blendMode as any;

        const container = (layer.zPosition === 'above') ? gridTexturesAboveLayer : gridTexturesBelowLayer;
        container.addChild(mesh);
        activeMeshes.push({ mesh, container });
    }

    synced = false;
}

/**
 * Sync mesh vertex positions with current grid displacement values.
 * Skips the update when the grid is settled and positions are already in sync.
 */
export function updateGridTextures(): void {
    if (activeMeshes.length === 0) return;

    if (isGridSettled() && synced) return;

    const grid = getGridGeometry();
    if (!grid.displaceX || !grid.displaceY) return;

    const { cols, rows, spacing, displaceX, displaceY } = grid;

    for (const entry of activeMeshes) {
        const posAttr = entry.mesh.geometry.getAttribute('aPosition');
        const positions = posAttr.buffer.data as Float32Array;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const gi = r * cols + c;
                const bi = gi * 2;
                positions[bi] = (c + 1) * spacing + displaceX![gi];
                positions[bi + 1] = (r + 1) * spacing + displaceY![gi];
            }
        }

        posAttr.buffer.update();
    }

    synced = isGridSettled();
}

/** Destroy all texture meshes and reset state. */
export function clearGridTextures(): void {
    for (const entry of activeMeshes) {
        entry.container.removeChild(entry.mesh);
        entry.mesh.destroy();
    }
    activeMeshes.length = 0;
    synced = false;
}

/** Build a flat Float32Array of rest-state (x, y) positions for all grid vertices. */
function buildRestPositions(cols: number, rows: number, spacing: number): Float32Array {
    const positions = new Float32Array(cols * rows * 2);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = (r * cols + c) * 2;
            positions[i] = (c + 1) * spacing;
            positions[i + 1] = (r + 1) * spacing;
        }
    }
    return positions;
}

/**
 * Build UV coordinates for a texture layer.
 * "cover" mode maps UVs to [0,1] across the full world.
 * "tile" mode repeats based on the configured tile cell count.
 */
function buildUVs(
    cols: number,
    rows: number,
    spacing: number,
    worldWidth: number,
    worldHeight: number,
    layer: TextureLayerDef,
): Float32Array {
    const uvs = new Float32Array(cols * rows * 2);

    if (layer.mode === 'cover') {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = (r * cols + c) * 2;
                uvs[i] = ((c + 1) * spacing) / worldWidth;
                uvs[i + 1] = ((r + 1) * spacing) / worldHeight;
            }
        }
    }

    else {
        const n = layer.tileCells ?? 1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = (r * cols + c) * 2;
                uvs[i] = c / n;
                uvs[i + 1] = r / n;
            }
        }
    }

    return uvs;
}
