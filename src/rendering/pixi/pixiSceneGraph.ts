import { Container } from 'pixi.js';

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

function addLayer(label: string): Container {
    const c = new Container();
    c.label = label;
    worldContainer.addChild(c);
    return c;
}
