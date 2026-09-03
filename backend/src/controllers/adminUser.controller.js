import bcrypt from 'bcrypt';
import Employee from '../models/employee.model.js';
import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/apiError.js';
import apiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createUser = asyncHandler(async (req, res) => {
    const { name, email, password, phone, address, role = 'customer' } = req.body;
    if (!name || !email || !password) {
        throw new ApiError(400, 'Name, email, and password are required');
    }
    if (password.length < 8) throw new ApiError(400, 'Password must contain at least 8 characters');
    if (await User.exists({ email: email.toLowerCase() })) {
        throw new ApiError(409, 'Email is already in use');
    }
    const user = await User.create({
        name,
        email: email.toLowerCase(),
        password_hash: await bcrypt.hash(password, 10),
        phone,
        address,
        role,
    });
    const safeUser = await User.findById(user._id).select('-password_hash');
    return apiResponse(res, 201, safeUser, 'User created successfully');
});

export const updateUser = asyncHandler(async (req, res) => {
    const { name, email, phone, address, role, is_active } = req.body;
    if (email && await User.exists({ email: email.toLowerCase(), _id: { $ne: req.params.id } })) {
        throw new ApiError(409, 'Email is already in use');
    }
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (phone !== undefined) updates.phone = phone || null;
    if (address !== undefined) updates.address = address || null;
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    const user = await User.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
    }).select('-password_hash');
    if (!user) throw new ApiError(404, 'User not found');
    return apiResponse(res, 200, user, 'User updated successfully');
});

export const deleteUser = asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) throw new ApiError(400, 'You cannot delete your own account');
    if (await Order.exists({ customer_id: req.params.id })) {
        throw new ApiError(409, 'Users with order history cannot be deleted; deactivate them instead');
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new ApiError(404, 'User not found');
    await Employee.deleteOne({ user_id: user._id });
    return apiResponse(res, 200, null, 'User deleted successfully');
});

export const getCustomerReport = asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: 'customer' }).select('-password_hash');
    if (!user) throw new ApiError(404, 'Customer not found');
    const orders = await Order.find({ customer_id: user._id })
        .populate('branch_id', 'name')
        .sort({ createdAt: -1 });
    const totalSpent = orders
        .filter((order) => order.payment_status === 'paid')
        .reduce((total, order) => total + order.total_price, 0);
    return apiResponse(res, 200, {
        user,
        summary: {
            totalOrders: orders.length,
            completedOrders: orders.filter((order) => order.status === 'delivered').length,
            totalSpent,
        },
        orders,
    }, 'Customer report retrieved successfully');
});
