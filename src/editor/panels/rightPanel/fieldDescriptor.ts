/**
 * Field descriptor types consumed by `propertyForm`. Each per-kind form
 * builder returns a `FieldDescriptor[]`; the form renders inputs by type.
 *
 * Part of the editor layer.
 */

export type FieldType = 'number' | 'text' | 'enum' | 'bool' | 'color' | 'readonly' | 'guid';

export interface FieldDescriptorBase {
    key: string;
    label: string;
    type: FieldType;
    /** Whether the field can be edited (default true except for readonly/guid). */
    disabled?: boolean;
    /** Inline validation warning shown beneath the field (red caption). */
    warning?: string;
}

export interface NumberFieldDescriptor extends FieldDescriptorBase {
    type: 'number';
    value: number;
    step?: number;
    min?: number;
    max?: number;
    onCommit: (next: number) => void;
}

export interface TextFieldDescriptor extends FieldDescriptorBase {
    type: 'text';
    value: string;
    onCommit: (next: string) => void;
    validate?: (next: string) => string | null;
}

export interface EnumFieldDescriptor extends FieldDescriptorBase {
    type: 'enum';
    value: string;
    options: { value: string; label: string }[];
    onCommit: (next: string) => void;
}

export interface BoolFieldDescriptor extends FieldDescriptorBase {
    type: 'bool';
    value: boolean;
    onCommit: (next: boolean) => void;
}

export interface ColorFieldDescriptor extends FieldDescriptorBase {
    type: 'color';
    /** RGB color 0-255 components. */
    value: { r: number; g: number; b: number };
    onCommit: (next: { r: number; g: number; b: number }) => void;
}

export interface ReadonlyFieldDescriptor extends FieldDescriptorBase {
    type: 'readonly';
    value: string;
}

export interface GuidFieldDescriptor extends FieldDescriptorBase {
    type: 'guid';
    value: string;
}

export type FieldDescriptor =
    | NumberFieldDescriptor
    | TextFieldDescriptor
    | EnumFieldDescriptor
    | BoolFieldDescriptor
    | ColorFieldDescriptor
    | ReadonlyFieldDescriptor
    | GuidFieldDescriptor;
