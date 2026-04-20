/**
 * Tests for buildAddLayerCommand.
 *
 * Part of the editor layer.
 */

import { describe, it, expect } from 'vitest';

import { createDefaultMapData } from '../../state/defaultMap';
import { createWorkingState } from '../../state/EditorWorkingState';
import { buildAddLayerCommand } from '../addLayerCommand';

describe('buildAddLayerCommand', () => {
    it('appends an object layer with the requested label', () => {
        const state = createWorkingState(createDefaultMapData());
        const result = buildAddLayerCommand(state, 'ground', 'New Layer 1');
        expect(result).not.toBe(null);
        result!.command.do(state);
        const added = state.map.layers.find((l) => l.id === result!.layerId);
        expect(added).toBeDefined();
        expect(added!.type).toBe('object');
        expect(added!.label).toBe('New Layer 1');
        expect(added!.locked).toBe(false);
        expect(added!.visible).toBe(true);
        expect(added!.walls).toEqual([]);
    });

    it('returns null for an unknown floor id', () => {
        const state = createWorkingState(createDefaultMapData());
        expect(buildAddLayerCommand(state, 'nope', 'X')).toBe(null);
    });

    it('undo removes the layer', () => {
        const state = createWorkingState(createDefaultMapData());
        const countBefore = state.map.layers.length;
        const result = buildAddLayerCommand(state, 'ground', 'Temp')!;
        result.command.do(state);
        expect(state.map.layers.length).toBe(countBefore + 1);
        result.command.undo(state);
        expect(state.map.layers.length).toBe(countBefore);
        expect(state.map.layers.find((l) => l.id === result.layerId)).toBeUndefined();
    });

    it('marks the command structural so auto-save can react', () => {
        const state = createWorkingState(createDefaultMapData());
        const result = buildAddLayerCommand(state, 'ground', 'X')!;
        expect(result.command.isStructural).toBe(true);
    });
});
