import { Container, Graphics } from 'pixi.js';

let backgroundRect: Graphics | null = null;

// World container -- camera transform applied here
export let worldContainer: Container;

// Layer containers (render order = declaration order)
export let backgroundLayer: Container;
export let wallLayer: Container;
export let lastKnownLayer: Container;
export let corpseLayer: Container;
export let grenadeLayer: Container;
export let smokeLayer: Container;
export let projectileLayer: Container;
export let playerLayer: Container;
export let healthBarLayer: Container;
export let nametagLayer: Container;
export let statusLabelLayer: Container;
export let aimLineLayer: Container;
export let fovConeLayer: Container;
export let explosionLayer: Container;
export let damageNumberLayer: Container;
export let fogOfWarLayer: Container;

export function createSceneGraph(stage: Container) {
    worldContainer = new Container();
    worldContainer.label = 'worldContainer';
    stage.addChild(worldContainer);

    backgroundLayer = addLayer('backgroundLayer');
    backgroundRect = new Graphics();
    backgroundLayer.addChild(backgroundRect);
    wallLayer = addLayer('wallLayer');
    lastKnownLayer = addLayer('lastKnownLayer');
    corpseLayer = addLayer('corpseLayer');
    grenadeLayer = addLayer('grenadeLayer');
    smokeLayer = addLayer('smokeLayer');
    projectileLayer = addLayer('projectileLayer');
    playerLayer = addLayer('playerLayer');
    healthBarLayer = addLayer('healthBarLayer');
    nametagLayer = addLayer('nametagLayer');
    statusLabelLayer = addLayer('statusLabelLayer');
    aimLineLayer = addLayer('aimLineLayer');
    fovConeLayer = addLayer('fovConeLayer');
    explosionLayer = addLayer('explosionLayer');
    damageNumberLayer = addLayer('damageNumberLayer');
    fogOfWarLayer = addLayer('fogOfWarLayer');
}

export function setWorldBounds(width: number, height: number) {
    if (!backgroundRect) return;
    backgroundRect.clear();
    backgroundRect.rect(0, 0, width, height).fill(0x0f0f1a);

    // Subtle dot grid for spatial awareness
    const spacing = 64;
    for (let x = spacing; x < width; x += spacing) {
        for (let y = spacing; y < height; y += spacing) {
            backgroundRect.circle(x, y, 1.2).fill({ color: 0xffffff, alpha: 0.3 });
            if (x + spacing < width) {
                backgroundRect.moveTo(x, y).lineTo(x + spacing, y).stroke({ color: 0xffffff, alpha: 0.05, width: 1 });
            }
            if (y + spacing < height) {
                backgroundRect.moveTo(x, y).lineTo(x, y + spacing).stroke({ color: 0xffffff, alpha: 0.05, width: 1 });
            }
        }
    }
}

function addLayer(label: string): Container {
    const c = new Container();
    c.label = label;
    worldContainer.addChild(c);
    return c;
}
