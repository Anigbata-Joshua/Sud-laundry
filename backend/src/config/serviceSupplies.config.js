// Owner: Josh
// Purpose: supply consumption rules keyed by SERVICE, not by workflow stage.

function tiered(small, medium, large) {
    return { small, medium, large };
}

// mapping of workflow stage → service categories that use it
export const STAGE_SERVICE_CATEGORIES = {
    washing: ['Laundry'],
    processing: ['Dry Cleaning'],
    packaging: [],
};

// key = exact Service.name from core services
export const SERVICE_SUPPLIES_RECIPE = {
    'Washing & Folding': tiered(
        [
            { productName: 'Laundry Detergent', quantity: 1, unit: 'scoop' },
            { productName: 'Fabric Softener', quantity: 1, unit: 'cap' },
        ],
        [
            { productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' },
            { productName: 'Fabric Softener', quantity: 1, unit: 'cap' },
        ],
        [
            { productName: 'Laundry Detergent', quantity: 3, unit: 'scoop' },
            { productName: 'Fabric Softener', quantity: 2, unit: 'cap' },
        ],
    ),
    'Washing & Ironing': tiered(
        [
            { productName: 'Laundry Detergent', quantity: 1, unit: 'scoop' },
            { productName: 'Fabric Softener', quantity: 1, unit: 'cap' },
            { productName: 'Ironing Starch', quantity: 1, unit: 'spray' },
        ],
        [
            { productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' },
            { productName: 'Fabric Softener', quantity: 1, unit: 'cap' },
            { productName: 'Ironing Starch', quantity: 2, unit: 'spray' },
        ],
        [
            { productName: 'Laundry Detergent', quantity: 3, unit: 'scoop' },
            { productName: 'Fabric Softener', quantity: 2, unit: 'cap' },
            { productName: 'Ironing Starch', quantity: 3, unit: 'spray' },
        ],
    ),
    Ironing: tiered(
        [{ productName: 'Ironing Starch', quantity: 1, unit: 'spray' }],
        [{ productName: 'Ironing Starch', quantity: 2, unit: 'spray' }],
        [{ productName: 'Ironing Starch', quantity: 3, unit: 'spray' }],
    ),
    'Dry Cleaning': tiered(
        [{ productName: 'Dry Cleaning Solvent', quantity: 1, unit: 'unit' }],
        [{ productName: 'Dry Cleaning Solvent', quantity: 2, unit: 'unit' }],
        [{ productName: 'Dry Cleaning Solvent', quantity: 3, unit: 'unit' }],
    ),
    'Dry Cleaning & Pressing': tiered(
        [
            { productName: 'Dry Cleaning Solvent', quantity: 1, unit: 'unit' },
            { productName: 'Ironing Starch', quantity: 1, unit: 'spray' },
        ],
        [
            { productName: 'Dry Cleaning Solvent', quantity: 2, unit: 'unit' },
            { productName: 'Ironing Starch', quantity: 2, unit: 'spray' },
        ],
        [
            { productName: 'Dry Cleaning Solvent', quantity: 3, unit: 'unit' },
            { productName: 'Ironing Starch', quantity: 3, unit: 'spray' },
        ],
    ),
};

// Default packaging applied to every order once it reaches the packaging stage.
// 1:1 with total garment count.
export const DEFAULT_PACKAGING_PER_UNIT = [
    { productName: 'Packaging Nylon', quantity: 1, unit: 'pieces' },
    { productName: 'Hanger', quantity: 1, unit: 'pieces' },
];

export function calculateEffectivePieces(quantity, pieceCount = 1) {
    const pc = Number(pieceCount);
    const validPc = Number.isFinite(pc) && pc > 0 ? pc : 1;
    return quantity * validPc;
}

export function getTier(quantity) {
    if (quantity <= 5) return 'small';
    if (quantity <= 10) return 'medium';
    return 'large';
}

export default SERVICE_SUPPLIES_RECIPE;