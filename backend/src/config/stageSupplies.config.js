// Owner: Josh
// Purpose: Configuration of default inventory supplies consumed per order task stage.

export const STAGE_SUPPLIES_RECIPE = {
    washing: [
        { productName: 'Laundry Detergent', defaultQuantity: 1, unit: 'scoop' },
        { productName: 'Fabric Softener', defaultQuantity: 1, unit: 'cap' },
    ],
    processing: [
        { productName: 'Ironing Starch', defaultQuantity: 1, unit: 'spray' },
    ],
    packaging: [
        { productName: 'Packaging Nylon', defaultQuantity: 1, unit: 'pieces' },
        { productName: 'Hanger', defaultQuantity: 1, unit: 'pieces' },
    ],
};

export default STAGE_SUPPLIES_RECIPE;
