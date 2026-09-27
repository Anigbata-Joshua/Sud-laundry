import test, { mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/models/user.model.js';
import { migrateInventoryRoles } from '../src/services/inventoryRoleMigration.service.js';

afterEach(() => mock.restoreAll());

test('inventory officer is the only supported inventory role', () => {
    const fields = { name: 'Inventory', email: 'inventory@example.com', password_hash: 'hash' };
    assert.equal(new User({ ...fields, role: 'inventory_officer' }).validateSync(), undefined);
    assert.ok(new User({ ...fields, role: 'inventory_manager' }).validateSync().errors.role);
});

test('migration updates only the retired role without changing account identity', async () => {
    const update = mock.method(User.collection, 'updateMany', async () => ({ modifiedCount: 1 }));
    assert.equal((await migrateInventoryRoles()).modifiedCount, 1);
    assert.deepEqual(update.mock.calls[0].arguments, [
        { role: 'inventory_manager' },
        { $set: { role: 'inventory_officer' } },
    ]);
});

test('migration propagates database errors so startup cannot accept unmigrated accounts', async () => {
    mock.method(User.collection, 'updateMany', async () => { throw new Error('Database unavailable'); });
    await assert.rejects(migrateInventoryRoles(), /Database unavailable/);
});
