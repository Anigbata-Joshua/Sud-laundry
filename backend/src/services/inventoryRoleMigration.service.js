import User from '../models/user.model.js';

// The collection bypasses schema validation for the retired role.
// Updating only the role preserves employee links and branch assignments.
export async function migrateInventoryRoles() {
    return User.collection.updateMany(
        { role: 'inventory_manager' },
        { $set: { role: 'inventory_officer' } },
    );
}
