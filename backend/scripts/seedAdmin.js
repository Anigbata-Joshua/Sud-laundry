import bcrypt from 'bcrypt';
import { closeDatabase, connectDatabase } from '../src/config/db.js';
import User from '../src/models/user.model.js';
import  dotenv  from 'dotenv';


dotenv.config();

const MINIMUM_PASSWORD_LENGTH = 3;

function getAdminDetails() {
    const name = process.env.ADMIN_NAME?.trim();
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password) {
        throw new Error(
            'ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be set in backend/.env.'
        );
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error('ADMIN_EMAIL must be a valid email address.');
    }

   
    return { name, email, password };
}

async function seedAdmin() {
    const adminDetails = getAdminDetails();
    await connectDatabase();

    const existingUser = await User.findOne({ email: adminDetails.email });

    if (existingUser) {
        if (existingUser.role !== 'admin') {
            throw new Error(
                'ADMIN_EMAIL belongs to a non-admin account. Choose another email or promote it through an authenticated admin workflow.'
            );
        }

        console.log(`Admin already exists: ${existingUser.email}`);
        return;
    }

    const existingAdmin = await User.exists({ role: 'admin' });

    if (existingAdmin) {
        throw new Error(
            'An administrator already exists. Create additional admins through an authenticated admin workflow.'
        );
    }

    const passwordHash = await bcrypt.hash(adminDetails.password, 12);

    const admin = await User.create({
        name: adminDetails.name,
        email: adminDetails.email,
        password_hash: passwordHash,
        role: 'admin',
        is_active: true,
    });

    console.log(`Admin created successfully: ${admin.email}`);
}

try {
    await seedAdmin();
} catch (error) {
    console.error(`Admin seed failed: ${error.message}`);
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
