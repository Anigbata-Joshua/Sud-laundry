// Owner: Josh
// Purpose: validation schemas for creating and updating branches.
// Trims whitespace so "   " can't slip past a truthy check and become
// a blank-looking branch name/address/phone.

import { z } from 'zod';

const requiredField = (label) =>
    z
        .string({ required_error: `${label} is required` })
        .trim()
        .min(1, `${label} cannot be empty`);

export const createBranchSchema = z.object({
    name: requiredField('name'),
    address: requiredField('address'),
    phone: requiredField('phone'),
});

export const updateBranchSchema = z
    .object({
        name: requiredField('name').optional(),
        address: requiredField('address').optional(),
        phone: requiredField('phone').optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: 'At least one field (name, address, phone) must be provided',
    });