import { describe, it, expect } from 'vitest';
import { Arena } from '@maps/arena';
import { Shipment } from '@maps/shipment';
import { validateMap } from '../MapValidator';

describe('built-in maps pass MapValidator', () => {
    it('Arena has no validation errors', () => {
        expect(validateMap(Arena)).toEqual([]);
    });

    it('Shipment has no validation errors', () => {
        expect(validateMap(Shipment)).toEqual([]);
    });
});
