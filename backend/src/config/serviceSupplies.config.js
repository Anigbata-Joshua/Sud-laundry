// Owner: Josh
// Purpose: supply consumption rules keyed by SERVICE, not by workflow stage.
// The old STAGE_SUPPLIES_RECIPE fired the same products for any step named
// "washing" regardless of what was actually ordered — a Dry Cleaning order
// would have consumed laundry detergent. This config is looked up by the
// order's actual service line(s), then tiered by garment quantity.
//
// STARTING DEFAULTS — NOT FINAL. Tune tier thresholds and quantities once
// real order sizes are observed. Tiers: small 1-5, medium 6-10, large 11+.

function tiered(small, medium, large) {
    return { small, medium, large };
}

// key = exact Service.name from services seed data
export const SERVICE_SUPPLIES_RECIPE = {
    Washing: tiered(
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
    // Folding needs no extra supply beyond washing itself.
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
    // Bigger single items — treat as flat regardless of tier (one duvet/curtain/
    // rug isn't "quantity" the same way garments are).
    'Duvet Cleaning': tiered(
        [{ productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' }],
        [{ productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' }],
        [{ productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' }],
    ),
    'Curtain Cleaning': tiered(
        [{ productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' }],
        [{ productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' }],
        [{ productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' }],
    ),
    'Carpet & Rug Cleaning': tiered(
        [{ productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' }],
        [{ productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' }],
        [{ productName: 'Laundry Detergent', quantity: 2, unit: 'scoop' }],
    ),
    'Shoe Cleaning': {
        // Scales 1:1 per pair rather than by tier.
        perUnit: [{ productName: 'Shoe Cleaner', quantity: 1, unit: 'unit' }],
    },
    // Add-ons: scale 1:1 with quantity, independent of workflow stage/tier.
    'Stain Removal': {
        perUnit: [{ productName: 'Stain Remover', quantity: 1, unit: 'unit' }],
    },
    'Perfume / Fragrance': {
        perUnit: [{ productName: 'Perfume', quantity: 1, unit: 'spray' }],
    },
    'Special Packaging': {
        perUnit: [{ productName: 'Premium Packaging Material', quantity: 1, unit: 'unit' }],
    },
};

// Default packaging applied to every order regardless of which services were
// ordered, once it reaches the packaging stage. 1:1 with total garment count.
export const DEFAULT_PACKAGING_PER_UNIT = [
    { productName: 'Packaging Nylon', quantity: 1, unit: 'pieces' },
    { productName: 'Hanger', quantity: 1, unit: 'pieces' },
];

export function getTier(quantity) {
    if (quantity <= 5) return 'small';
    if (quantity <= 10) return 'medium';
    return 'large';
}

export default SERVICE_SUPPLIES_RECIPE;