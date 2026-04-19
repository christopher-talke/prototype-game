/**
 * Default-value factory for EntityStateFieldDescriptor variants.
 *
 * Used when initialising a freshly-placed entity (createEntityCommand) and
 * when appending a new element via the array editor in the right panel.
 *
 * Part of the editor layer.
 */

import type { EntityStateFieldDescriptor } from '@shared/map/MapData';

/** Return a sensible default value for a schema descriptor. */
export function defaultForEntityStateDescriptor(descriptor: EntityStateFieldDescriptor): unknown {
    switch (descriptor.type) {
        case 'primitive':
            return 0;
        case 'layerId':
        case 'entityId':
        case 'teamId':
        case 'signalId':
            return '';
        case 'color':
            return { r: 0, g: 0, b: 0 };
        case 'range':
            return descriptor.min;
        case 'nested': {
            const out: Record<string, unknown> = {};
            for (const [k, d] of Object.entries(descriptor.fields)) {
                out[k] = defaultForEntityStateDescriptor(d);
            }
            return out;
        }
        case 'array':
            return [];
    }
}
