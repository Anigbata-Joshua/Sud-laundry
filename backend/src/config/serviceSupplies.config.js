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

// Derive core supplies required across all service recipes and packaging
const DEFAULT_REORDER_POINTS = {
    'Laundry Detergent': 20,
    'Fabric Softener': 10,
    'Ironing Starch': 10,
    'Dry Cleaning Solvent': 10,
    'Packaging Nylon': 20,
    'Hanger': 20,
};

const DEFAULT_SEED_QUANTITIES = {
    'Laundry Detergent': 100,
    'Fabric Softener': 50,
    'Ironing Starch': 50,
    'Dry Cleaning Solvent': 50,
    'Packaging Nylon': 100,
    'Hanger': 100,
};

export function getCoreRecipeSupplies() {
    const suppliesMap = new Map();
    const addSupply = (name, unit) => {
        if (!suppliesMap.has(name)) {
            suppliesMap.set(name, {
                name,
                unit,
                default_reorder_point: DEFAULT_REORDER_POINTS[name] || 10,
                default_quantity: DEFAULT_SEED_QUANTITIES[name] || 50,
            });
        }
    };
    for (const recipe of Object.values(SERVICE_SUPPLIES_RECIPE)) {
        if (recipe.perUnit) {
            for (const s of recipe.perUnit) addSupply(s.productName, s.unit);
        } else {
            for (const tierList of Object.values(recipe)) {
                if (Array.isArray(tierList)) {
                    for (const s of tierList) addSupply(s.productName, s.unit);
                }
            }
        }
    }
    for (const pkg of DEFAULT_PACKAGING_PER_UNIT) {
        addSupply(pkg.productName, pkg.unit);
    }
    return Array.from(suppliesMap.values());
}

export const CORE_RECIPE_SUPPLIES = getCoreRecipeSupplies();
export default SERVICE_SUPPLIES_RECIPE;