// Production-Grade Automated Test Suite for Laundry & Dry-Cleaning API
// Benchmarks response time (latency in ms), Authentication, Role-based Authorization,
// Multi-tenant Branch Scoping, Pagination, Filtering, Search, and Real-time Stage Consumption Engine.

import axios from 'axios';
import mongoose from 'mongoose';
import User from '../src/models/user.model.js';
import Employee from '../src/models/employee.model.js';
import { env } from '../src/config/env.js';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4567';
const API = `${BASE_URL}/api/v1`;

const results = [];
let passCount = 0;
let failCount = 0;

// Test state
let tokens = {
    admin: null,
    branchManager: null,
    employee: null,
    customer: null,
};

let entities = {
    branchId: null,
    serviceId: null,
    adminUserId: null,
    managerUserId: null,
    employeeUserId: null,
    customerUserId: null,
    employeeId: null,
    managerEmployeeId: null,
    productId: null,
    detergentProductId: null,
    supplierId: null,
    orderId: null,
    taskId: null,
    leaveRequestId: null,
    paymentId: null,
};

const record = (category, testName, passed, latencyMs, details = {}) => {
    if (passed) passCount++;
    else failCount++;

    results.push({
        category,
        testName,
        passed,
        latencyMs: Math.round(latencyMs),
        ...details,
    });

    const symbol = passed ? '✅' : '❌';
    console.log(`${symbol} [${category}] ${testName} (${Math.round(latencyMs)}ms)`);
    if (!passed && details.error) {
        console.error(`   -> Error / Details: ${details.error}`);
    }
};

const timedRequest = async (config) => {
    const start = performance.now();
    try {
        const response = await axios({
            baseURL: BASE_URL,
            validateStatus: () => true, // Don't throw on HTTP errors so we can assert status codes
            ...config,
        });
        const duration = performance.now() - start;
        return { response, duration, error: null };
    } catch (err) {
        const duration = performance.now() - start;
        return { response: null, duration, error: err.message };
    }
};

async function runSuite() {
    console.log(`\n======================================================`);
    console.log(`🚀 STARTING FULL PRODUCTION TEST SUITE ON: ${BASE_URL}`);
    console.log(`======================================================\n`);

    // Connect to database directly for test fixtures role promotion
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(env.mongoURI);
    }

    const runTimestamp = Date.now();

    // 1. Health Check & Latency Benchmark
    {
        const { response, duration, error } = await timedRequest({
            method: 'GET',
            url: '/api/health',
        });
        const ok = response?.status === 200 && response?.data?.status === 'OK';
        record('System Health', 'GET /api/health (Uptime check)', ok, duration, {
            status: response?.status,
            error: error || (ok ? null : JSON.stringify(response?.data)),
        });
    }

    // 2. Authentication: Setup Users & Role-Based Token Generation
    {
        // 2a. Admin Registration & Promotion
        const adminEmail = `test_admin_${runTimestamp}@laundryapp.com`;
        await timedRequest({
            method: 'POST',
            url: '/api/v1/auth/register',
            data: {
                name: 'Test Super Admin',
                email: adminEmail,
                password: 'Password123!',
                phone: '+2348011111111',
            },
        });

        // Promote to admin
        const adminUser = await User.findOneAndUpdate({ email: adminEmail }, { role: 'admin' }, { new: true });
        entities.adminUserId = adminUser?._id?.toString();

        const { response: loginAdmin, duration: dAdmin } = await timedRequest({
            method: 'POST',
            url: '/api/v1/auth/login',
            data: { email: adminEmail, password: 'Password123!' },
        });

        tokens.admin = loginAdmin?.data?.data?.token;
        record('Authentication', 'POST /auth/login (Admin Token Generated)', !!tokens.admin, dAdmin, {
            status: loginAdmin?.status,
        });

        // 2b. Customer Registration & Login
        const customerEmail = `test_cust_${runTimestamp}@laundryapp.com`;
        await timedRequest({
            method: 'POST',
            url: '/api/v1/auth/register',
            data: {
                name: 'Test Customer',
                email: customerEmail,
                password: 'Password123!',
                phone: '+2348022222222',
            },
        });

        const custUser = await User.findOne({ email: customerEmail });
        entities.customerUserId = custUser?._id?.toString();

        const { response: loginCust, duration: dCust } = await timedRequest({
            method: 'POST',
            url: '/api/v1/auth/login',
            data: { email: customerEmail, password: 'Password123!' },
        });

        tokens.customer = loginCust?.data?.data?.token;
        record('Authentication', 'POST /auth/login (Customer Token Generated)', !!tokens.customer, dCust, {
            status: loginCust?.status,
        });

        // 2c. Branch Manager User Registration & Role Setup
        const mgrEmail = `test_mgr_${runTimestamp}@laundryapp.com`;
        await timedRequest({
            method: 'POST',
            url: '/api/v1/auth/register',
            data: {
                name: 'Test Branch Manager',
                email: mgrEmail,
                password: 'Password123!',
                phone: '+2348033333333',
            },
        });

        const mgrUser = await User.findOneAndUpdate({ email: mgrEmail }, { role: 'branch_manager' }, { new: true });
        entities.managerUserId = mgrUser?._id?.toString();

        // 2d. Employee User Registration & Role Setup
        const empEmail = `test_emp_${runTimestamp}@laundryapp.com`;
        await timedRequest({
            method: 'POST',
            url: '/api/v1/auth/register',
            data: {
                name: 'Test Staff Member',
                email: empEmail,
                password: 'Password123!',
                phone: '+2348044444444',
            },
        });

        const empUser = await User.findOneAndUpdate({ email: empEmail }, { role: 'employee' }, { new: true });
        entities.employeeUserId = empUser?._id?.toString();
    }

    // 3. Multi-Tenant Branch Management (Admin Only)
    {
        const { response, duration } = await timedRequest({
            method: 'POST',
            url: '/api/v1/branches',
            headers: { Authorization: `Bearer ${tokens.admin}` },
            data: {
                name: `Lagos Victoria Island Branch ${runTimestamp}`,
                address: '12 Admiralty Way, Lekki Phase 1',
                phone: '+2348000000001',
                email: `lekki_${runTimestamp}@laundryapp.com`,
            },
        });

        const ok = response?.status === 201 && !!response?.data?.data?._id;
        entities.branchId = response?.data?.data?._id;
        record('Branches', 'POST /branches (Create Branch by Admin)', ok, duration, {
            status: response?.status,
            error: ok ? null : JSON.stringify(response?.data),
        });

        // Unauthorized access check
        const { response: unauthRes, duration: dUnauth } = await timedRequest({
            method: 'POST',
            url: '/api/v1/branches',
            headers: { Authorization: `Bearer ${tokens.customer}` },
            data: { name: 'Unauthorized Branch' },
        });
        const isForbidden = unauthRes?.status === 403;
        record('Authorization', 'POST /branches (Customer Access Denied 403)', isForbidden, dUnauth, {
            status: unauthRes?.status,
        });

        // GET /branches with pagination
        const { response: getBranches, duration: dGet } = await timedRequest({
            method: 'GET',
            url: '/api/v1/branches?page=1&limit=10',
            headers: { Authorization: `Bearer ${tokens.admin}` },
        });
        record('Branches & Pagination', 'GET /branches (Pagination & List)', getBranches?.status === 200, dGet, {
            status: getBranches?.status,
        });
    }

    // 4. Staff & Employee Assignment
    {
        // 4a. Create Branch Manager Employee record so their branch_id context resolves
        if (entities.managerUserId && entities.branchId) {
            const { response: createMgrEmp } = await timedRequest({
                method: 'POST',
                url: '/api/v1/employees',
                headers: { Authorization: `Bearer ${tokens.admin}` },
                data: {
                    user_id: entities.managerUserId,
                    branch_id: entities.branchId,
                    job_title: 'Branch Operations Manager',
                    hired_at: new Date().toISOString(),
                },
            });
            entities.managerEmployeeId = createMgrEmp?.data?.data?._id;

            // Login branch manager to get manager token with branch_id
            const { response: loginMgr } = await timedRequest({
                method: 'POST',
                url: '/api/v1/auth/login',
                data: { email: `test_mgr_${runTimestamp}@laundryapp.com`, password: 'Password123!' },
            });
            tokens.branchManager = loginMgr?.data?.data?.token;
        }

        // 4b. Create Employee record for staff
        if (entities.employeeUserId && entities.branchId) {
            const { response: createEmp, duration: dEmp } = await timedRequest({
                method: 'POST',
                url: '/api/v1/employees',
                headers: { Authorization: `Bearer ${tokens.admin}` },
                data: {
                    user_id: entities.employeeUserId,
                    branch_id: entities.branchId,
                    job_title: 'Washing Specialist',
                    hired_at: new Date().toISOString(),
                },
            });
            entities.employeeId = createEmp?.data?.data?._id;
            record('Employees', 'POST /employees (Create Staff Assignment)', createEmp?.status === 201, dEmp, {
                status: createEmp?.status,
            });

            // Login staff to get employee token
            const { response: loginEmp } = await timedRequest({
                method: 'POST',
                url: '/api/v1/auth/login',
                data: { email: `test_emp_${runTimestamp}@laundryapp.com`, password: 'Password123!' },
            });
            tokens.employee = loginEmp?.data?.data?.token;
        }

        // GET /employees
        const { response: listEmp, duration: dListEmp } = await timedRequest({
            method: 'GET',
            url: '/api/v1/employees',
            headers: { Authorization: `Bearer ${tokens.admin}` },
        });
        record('Employees', 'GET /employees (List Staff with Relations)', listEmp?.status === 200, dListEmp, {
            status: listEmp?.status,
        });
    }

    // 5. Service Catalog & Price Controls (Admin Only)
    {
        const { response: createSvc, duration: dSvc } = await timedRequest({
            method: 'POST',
            url: '/api/v1/services',
            headers: { Authorization: `Bearer ${tokens.admin}` },
            data: {
                name: `Premium Suit Dry Clean ${runTimestamp}`,
                description: 'Full gentle dry cleaning and steam press',
                price: 5000,
                unit: 'piece',
                category: 'dry_cleaning',
            },
        });

        entities.serviceId = createSvc?.data?.data?._id;
        record('Services', 'POST /services (Create Service by Admin)', createSvc?.status === 201, dSvc, {
            status: createSvc?.status,
            error: createSvc?.status === 201 ? null : JSON.stringify(createSvc?.data),
        });

        // Price update control (Admin only)
        if (entities.serviceId) {
            const { response: updatePrice, duration: dPrice } = await timedRequest({
                method: 'PATCH',
                url: `/api/v1/services/${entities.serviceId}/price`,
                headers: { Authorization: `Bearer ${tokens.admin}` },
                data: { price: 5500 },
            });
            record('Services & Pricing', 'PATCH /services/:id/price (Admin Price Update)', updatePrice?.status === 200, dPrice, {
                status: updatePrice?.status,
            });
        }

        // Service listing with active filter
        const { response: filterSvc, duration: dFilterSvc } = await timedRequest({
            method: 'GET',
            url: '/api/v1/services?is_active=true',
            headers: { Authorization: `Bearer ${tokens.customer}` },
        });
        record('Services & Filtering', 'GET /services?is_active=true (Catalog Filter)', filterSvc?.status === 200, dFilterSvc, {
            status: filterSvc?.status,
        });
    }

    // 6. Product Inventory & Double-Entry Stock Movement Ledger
    {
        // 6a. Create Product (Starting quantity 0)
        const { response: prodRes, duration: dProd } = await timedRequest({
            method: 'POST',
            url: '/api/v1/products',
            headers: { Authorization: `Bearer ${tokens.admin}` },
            data: {
                name: 'Laundry Detergent',
                branch_id: entities.branchId,
                unit: 'scoop',
                reorder_point: 5,
                cost_price: 200,
            },
        });

        entities.detergentProductId = prodRes?.data?.data?._id;
        record('Inventory', 'POST /products (Create Product at Branch)', prodRes?.status === 201, dProd, {
            status: prodRes?.status,
            error: prodRes?.status === 201 ? null : JSON.stringify(prodRes?.data),
        });

        // 6b. Stock Movement Procurement (Purchase 50 scoops)
        if (entities.detergentProductId && entities.branchId) {
            const { response: stockRes, duration: dStock } = await timedRequest({
                method: 'POST',
                url: '/api/v1/stock-movements',
                headers: { Authorization: `Bearer ${tokens.admin}` },
                data: {
                    product_id: entities.detergentProductId,
                    branch_id: entities.branchId,
                    type: 'purchase',
                    quantity: 50,
                    notes: 'Initial bulk stock purchase from supplier',
                },
            });

            const stockOk = stockRes?.status === 201 && stockRes?.data?.data?.quantity === 50;
            record('Inventory Ledger', 'POST /stock-movements (Procurement +50 Qty)', stockOk, dStock, {
                status: stockRes?.status,
                error: stockOk ? null : JSON.stringify(stockRes?.data),
            });
        }

        // 6c. Verify Product Search & Filter
        const { response: searchProd, duration: dSearch } = await timedRequest({
            method: 'GET',
            url: `/api/v1/products?branch_id=${entities.branchId}&q=Detergent`,
            headers: { Authorization: `Bearer ${tokens.admin}` },
        });
        const found = searchProd?.data?.data?.items?.length > 0;
        record('Inventory & Search', 'GET /products?q=Detergent (Regex Search)', found, dSearch, {
            status: searchProd?.status,
        });
    }

    // 7. Order Placement & Stage Supply Deduction Lifecycle
    {
        if (entities.branchId && entities.serviceId) {
            // 7a. Place Order as Customer
            const { response: orderRes, duration: dOrder } = await timedRequest({
                method: 'POST',
                url: '/api/v1/orders',
                headers: { Authorization: `Bearer ${tokens.customer}` },
                data: {
                    branch_id: entities.branchId,
                    pickup_date: new Date(Date.now() + 86400000).toISOString(),
                    delivery_address: '15 Admiralty Road, Lekki',
                    fulfillment: 'delivery',
                    items: [
                        {
                            service_id: entities.serviceId,
                            quantity: 2,
                            item_notes: 'Delicate silk material',
                        },
                    ],
                },
            });

            entities.orderId = orderRes?.data?.data?._id;
            const orderOk = orderRes?.status === 201 && !!entities.orderId;
            record('Orders', 'POST /orders (Customer Places Order)', orderOk, dOrder, {
                status: orderRes?.status,
                error: orderOk ? null : JSON.stringify(orderRes?.data),
            });

            // 7b. Create Task for Order Stage (washing)
            if (entities.orderId && entities.employeeId) {
                const { response: taskRes, duration: dTask } = await timedRequest({
                    method: 'POST',
                    url: '/api/v1/tasks',
                    headers: { Authorization: `Bearer ${tokens.admin}` },
                    data: {
                        employee_id: entities.employeeId,
                        order_id: entities.orderId,
                        stage: 'washing',
                    },
                });

                entities.taskId = taskRes?.data?.data?._id;
                record('Tasks & Workflow', 'POST /tasks (Assign Stage Task)', taskRes?.status === 201, dTask, {
                    status: taskRes?.status,
                    error: taskRes?.status === 201 ? null : JSON.stringify(taskRes?.data),
                });

                // 7c. Complete Task Stage -> Tests Real-time Supply Deduction Engine!
                if (entities.taskId) {
                    const { response: compRes, duration: dComp } = await timedRequest({
                        method: 'PATCH',
                        url: `/api/v1/tasks/${entities.taskId}/status`,
                        headers: { Authorization: `Bearer ${tokens.admin}` },
                        data: {
                            status: 'completed',
                            notes: 'Washing completed with organic detergent',
                        },
                    });

                    record(
                        'Stage Consumption Engine',
                        'PATCH /tasks/:id/status (Complete -> Auto-Deduct Inventory)',
                        compRes?.status === 200 && compRes?.data?.data?.status === 'completed',
                        dComp,
                        { status: compRes?.status }
                    );

                    // 7d. Verify audit ledger entry was logged automatically
                    const { response: moveRes, duration: dMove } = await timedRequest({
                        method: 'GET',
                        url: `/api/v1/stock-movements?order_id=${entities.orderId}`,
                        headers: { Authorization: `Bearer ${tokens.admin}` },
                    });
                    const hasUsage = moveRes?.data?.data?.items?.some((m) => m.type === 'usage');
                    record('Inventory Audit Trail', 'GET /stock-movements (Auto-Logged Usage Check)', hasUsage, dMove, {
                        status: moveRes?.status,
                    });
                }
            }
        }
    }

    // 8. Leave Request & IDOR Protection Test
    {
        if (tokens.employee && entities.employeeId) {
            // Valid employee submission
            const { response: leaveRes, duration: dLeave } = await timedRequest({
                method: 'POST',
                url: '/api/v1/leave-requests',
                headers: { Authorization: `Bearer ${tokens.employee}` },
                data: {
                    start_date: new Date(Date.now() + 86400000).toISOString(),
                    end_date: new Date(Date.now() + 86400000 * 3).toISOString(),
                    reason: 'Annual family holiday leave',
                },
            });

            entities.leaveRequestId = leaveRes?.data?.data?._id;
            record('Leave Management', 'POST /leave-requests (Staff Submits Leave)', leaveRes?.status === 201, dLeave, {
                status: leaveRes?.status,
            });

            // Date validation check (start_date > end_date -> expect 400)
            const { response: badDateRes, duration: dBadDate } = await timedRequest({
                method: 'POST',
                url: '/api/v1/leave-requests',
                headers: { Authorization: `Bearer ${tokens.employee}` },
                data: {
                    start_date: new Date(Date.now() + 86400000 * 5).toISOString(),
                    end_date: new Date(Date.now() + 86400000 * 2).toISOString(),
                    reason: 'Invalid inverted dates',
                },
            });
            record(
                'Validation',
                'POST /leave-requests (Inverted Dates 400 Bad Request)',
                badDateRes?.status === 400,
                dBadDate,
                { status: badDateRes?.status }
            );
        }
    }

    // 9. Suppliers & Search Test
    {
        // 9a. Create Supplier with Structured Contact
        const { response: supRes, duration: dSup } = await timedRequest({
            method: 'POST',
            url: '/api/v1/suppliers',
            headers: { Authorization: `Bearer ${tokens.admin}` },
            data: {
                name: `EcoClean Chemicals Ltd ${runTimestamp}`,
                contact: {
                    phone: '+2348099998888',
                    email: 'sales@ecoclean.ng',
                    address: '8 Commercial Avenue, Yaba, Lagos',
                },
                items_supplied: ['Laundry Detergent', 'Fabric Softener', 'Packaging Nylon'],
            },
        });

        entities.supplierId = supRes?.data?.data?._id;
        record('Suppliers', 'POST /suppliers (Structured Contact Subdocument)', supRes?.status === 201, dSup, {
            status: supRes?.status,
            error: supRes?.status === 201 ? null : JSON.stringify(supRes?.data),
        });

        // 9b. Search Supplier via Regex
        const { response: searchSup, duration: dSearchSup } = await timedRequest({
            method: 'GET',
            url: '/api/v1/suppliers?q=EcoClean',
            headers: { Authorization: `Bearer ${tokens.admin}` },
        });
        record('Suppliers & Search', 'GET /suppliers?q=EcoClean (Subfield Regex Search)', searchSup?.status === 200, dSearchSup, {
            status: searchSup?.status,
        });

        // 9c. Backwards compatibility alias /supliers
        const { response: aliasRes, duration: dAlias } = await timedRequest({
            method: 'GET',
            url: '/api/v1/supliers?page=1&limit=5',
            headers: { Authorization: `Bearer ${tokens.admin}` },
        });
        record('Backwards Compatibility', 'GET /supliers (Route Alias Validation)', aliasRes?.status === 200, dAlias, {
            status: aliasRes?.status,
        });
    }

    // 10. Payments & Billing Flow
    {
        if (entities.orderId) {
            // Cash payment completion
            const { response: payRes, duration: dPay } = await timedRequest({
                method: 'POST',
                url: '/api/v1/payments',
                headers: { Authorization: `Bearer ${tokens.admin}` },
                data: {
                    orderId: entities.orderId,
                    paymentMethod: 'cash',
                    customer_Name: 'Test Customer',
                    paymentType: 'full payment',
                },
            });

            entities.paymentId = payRes?.data?.data?._id;
            record('Billing & Payments', 'POST /payments (Cash Payment & Surcharge Settlement)', payRes?.status === 201, dPay, {
                status: payRes?.status,
            });

            // Customer retrieving own payments
            const { response: custPay, duration: dCustPay } = await timedRequest({
                method: 'GET',
                url: '/api/v1/payments',
                headers: { Authorization: `Bearer ${tokens.customer}` },
            });
            record('Payments & Multi-Tenancy', 'GET /payments (Customer View Own Payments)', custPay?.status === 200, dCustPay, {
                status: custPay?.status,
            });
        }
    }

    // 11. Reports & Analytics Aggregation Pipelines
    {
        const reports = [
            { path: 'revenue', name: 'GET /reports/revenue (Total Revenue Aggregation)' },
            { path: 'payment-methods', name: 'GET /reports/payment-methods (Payment Breakdown)' },
            { path: 'revenue-trend', name: 'GET /reports/revenue-trend (Daily Trend Analysis)' },
            { path: 'top-customers', name: 'GET /reports/top-customers (Top Spending Clients)' },
            { path: 'order-volume', name: 'GET /reports/order-volume (Status Distribution)' },
            { path: 'top-services', name: 'GET /reports/top-services (Top Service Items)' },
        ];

        for (const rep of reports) {
            const { response, duration } = await timedRequest({
                method: 'GET',
                url: `/api/v1/reports/${rep.path}?branch_id=${entities.branchId}`,
                headers: { Authorization: `Bearer ${tokens.admin}` },
            });
            record('Reports & Analytics', rep.name, response?.status === 200, duration, {
                status: response?.status,
                error: response?.status === 200 ? null : JSON.stringify(response?.data),
            });
        }
    }

    // 12. Concurrency & Performance Load Burst
    {
        console.log('\n⚡ Running Concurrency Load Benchmark (10 concurrent requests)...');
        const startBurst = performance.now();
        const promises = Array.from({ length: 10 }, (_, i) =>
            timedRequest({
                method: 'GET',
                url: '/api/v1/services?is_active=true',
                headers: { Authorization: `Bearer ${tokens.customer}` },
            })
        );
        const burstResponses = await Promise.all(promises);
        const totalBurstTime = performance.now() - startBurst;
        const allBurstOk = burstResponses.every((r) => r.response?.status === 200);
        const avgLatency = Math.round(burstResponses.reduce((acc, r) => acc + r.duration, 0) / burstResponses.length);

        record(
            'Performance & Load',
            '10 Concurrent Requests to /services (Avg ' + avgLatency + 'ms)',
            allBurstOk,
            totalBurstTime,
            { avgLatencyMs: avgLatency }
        );
    }

    // Close database connection
    await mongoose.connection.close();

    // Print summary
    console.log(`\n======================================================`);
    console.log(`📊 TEST SUITE SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log(`======================================================\n`);

    const latencies = results.map((r) => r.latencyMs);
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

    console.log(`⏱️ Latency Benchmarks:`);
    console.log(`   - Minimum: ${minLatency} ms`);
    console.log(`   - Maximum: ${maxLatency} ms`);
    console.log(`   - Average: ${avgLatency} ms`);

    return {
        passCount,
        failCount,
        results,
        minLatency,
        maxLatency,
        avgLatency,
    };
}

runSuite()
    .then((summary) => {
        if (summary.failCount > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    })
    .catch((err) => {
        console.error('Fatal test runner error:', err);
        process.exit(1);
    });
