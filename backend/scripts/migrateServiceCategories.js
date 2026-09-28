import { connectDatabase, closeDatabase } from '../src/config/db.js';
import Service from '../src/models/service.model.js';
import ServiceCategory from '../src/models/serviceCategory.model.js';
import Order from '../src/models/order.model.js';

// Idempotent: link existing catalog entries without changing historical orders.
try {
    await connectDatabase();
    await ServiceCategory.createIndexes();
    let linked = 0;
    for await (const service of Service.find({ category_id: null }).cursor()) {
        const name = service.category?.trim() || 'general';
        const category = await ServiceCategory.findOneAndUpdate(
            { branch_id: service.branch_id, name_key: name.toLowerCase() },
            { $setOnInsert: { name, name_key: name.toLowerCase(), branch_id: service.branch_id } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
        const result = await Service.updateOne({ _id: service._id, category_id: null },
            { $set: { category_id: category._id, category: name } });
        linked += result.modifiedCount;
    }
    await Service.createIndexes();
    await Order.createIndexes();
    console.log(`Linked ${linked} services to reusable categories.`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
