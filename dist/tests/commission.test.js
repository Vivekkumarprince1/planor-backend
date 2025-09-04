"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const mongoose_1 = __importDefault(require("mongoose"));
const index_1 = __importDefault(require("../src/index"));
const User_1 = require("../src/models/User");
const Service_1 = require("../src/models/Service");
const Commission_1 = require("../src/models/Commission");
const Taxonomy_1 = require("../src/models/Taxonomy");
describe('Commission Management', () => {
    let adminToken;
    let managerToken;
    let categoryId;
    let subcategoryId;
    let serviceId;
    let commissionId;
    beforeAll(async () => {
        // Clean up
        await User_1.User.deleteMany({});
        await Service_1.Service.deleteMany({});
        await Commission_1.Commission.deleteMany({});
        await Taxonomy_1.Category.deleteMany({});
        await Taxonomy_1.Subcategory.deleteMany({});
        // Create admin user
        const adminUser = await User_1.User.create({
            name: 'Admin User',
            email: 'admin@test.com',
            password: 'password123',
            role: 'admin',
            approved: true
        });
        // Create manager user
        const managerUser = await User_1.User.create({
            name: 'Manager User',
            email: 'manager@test.com',
            password: 'password123',
            role: 'manager',
            approved: true
        });
        // Login to get tokens
        const adminLoginRes = await (0, supertest_1.default)(index_1.default)
            .post('/api/v1/auth/login')
            .send({ email: 'admin@test.com', password: 'password123' });
        adminToken = adminLoginRes.body.data.tokens.accessToken;
        const managerLoginRes = await (0, supertest_1.default)(index_1.default)
            .post('/api/v1/auth/login')
            .send({ email: 'manager@test.com', password: 'password123' });
        managerToken = managerLoginRes.body.data.tokens.accessToken;
        // Create category and subcategory
        const category = await Taxonomy_1.Category.create({
            name: 'Test Category',
            slug: 'test-category',
            isActive: true
        });
        categoryId = category._id.toString();
        const subcategory = await Taxonomy_1.Subcategory.create({
            categoryId: category._id,
            name: 'Test Subcategory',
            slug: 'test-subcategory',
            isActive: true
        });
        subcategoryId = subcategory._id.toString();
    });
    afterAll(async () => {
        await User_1.User.deleteMany({});
        await Service_1.Service.deleteMany({});
        await Commission_1.Commission.deleteMany({});
        await Taxonomy_1.Category.deleteMany({});
        await Taxonomy_1.Subcategory.deleteMany({});
    });
    describe('Manager Commission Workflow', () => {
        it('should create service with commission offer', async () => {
            const serviceData = {
                categoryId,
                subcategoryId,
                title: 'Test Service',
                description: 'A test service',
                basePrice: 1000,
                commissionOffered: 15,
                commissionNotes: 'Initial offer of 15%',
                areaServed: ['Test Area'],
                features: ['Test Feature']
            };
            const res = await (0, supertest_1.default)(index_1.default)
                .post('/api/v1/manager/services')
                .set('Authorization', `Bearer ${managerToken}`)
                .send(serviceData);
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.commissionOffered).toBe(15);
            serviceId = res.body.data._id;
            // Check that commission record was created
            const commission = await Commission_1.Commission.findOne({ serviceId });
            expect(commission).toBeTruthy();
            expect(commission?.offeredPercentage).toBe(15);
            expect(commission?.status).toBe('pending');
            commissionId = (commission?._id).toString();
        });
        it('should get manager commissions', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .get('/api/v1/manager/commissions')
                .set('Authorization', `Bearer ${managerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.items).toHaveLength(1);
            expect(res.body.data.items[0].offeredPercentage).toBe(15);
        });
    });
    describe('Admin Commission Management', () => {
        it('should get all commissions for admin', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .get('/api/v1/admin/commissions')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.items).toHaveLength(1);
        });
        it('should accept commission', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/admin/commissions/${commissionId}/respond`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                action: 'accept',
                notes: 'Approved commission at offered rate'
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('accepted');
            expect(res.body.data.finalPercentage).toBe(15);
            // Verify service was updated
            const service = await Service_1.Service.findById(serviceId);
            expect(service?.commissionStatus).toBe('agreed');
            expect(service?.finalCommissionPercentage).toBe(15);
        });
        it('should create new commission for counter offer test', async () => {
            const commission = await Commission_1.Commission.create({
                managerId: new mongoose_1.default.Types.ObjectId(),
                serviceId: new mongoose_1.default.Types.ObjectId(),
                offeredPercentage: 20,
                status: 'pending'
            });
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/admin/commissions/${commission._id}/respond`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                action: 'counter',
                counterPercentage: 12,
                notes: 'Counter offer at 12%'
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('negotiating');
            expect(res.body.data.adminCounterPercentage).toBe(12);
        });
        it('should reject commission', async () => {
            const commission = await Commission_1.Commission.create({
                managerId: new mongoose_1.default.Types.ObjectId(),
                serviceId: new mongoose_1.default.Types.ObjectId(),
                offeredPercentage: 25,
                status: 'pending'
            });
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/admin/commissions/${commission._id}/respond`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                action: 'reject',
                notes: 'Commission rate too high'
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('rejected');
        });
        it('should handle bulk commission actions', async () => {
            // Create multiple commissions
            const commission1 = await Commission_1.Commission.create({
                managerId: new mongoose_1.default.Types.ObjectId(),
                serviceId: new mongoose_1.default.Types.ObjectId(),
                offeredPercentage: 10,
                status: 'pending'
            });
            const commission2 = await Commission_1.Commission.create({
                managerId: new mongoose_1.default.Types.ObjectId(),
                serviceId: new mongoose_1.default.Types.ObjectId(),
                offeredPercentage: 15,
                status: 'pending'
            });
            const res = await (0, supertest_1.default)(index_1.default)
                .patch('/api/v1/admin/commissions/bulk')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                commissionIds: [commission1._id.toString(), commission2._id.toString()],
                action: 'accept',
                notes: 'Bulk approval'
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.results).toHaveLength(2);
            expect(res.body.data.results[0].success).toBe(true);
            expect(res.body.data.results[1].success).toBe(true);
        });
        it('should validate counter percentage', async () => {
            const commission = await Commission_1.Commission.create({
                managerId: new mongoose_1.default.Types.ObjectId(),
                serviceId: new mongoose_1.default.Types.ObjectId(),
                offeredPercentage: 20,
                status: 'pending'
            });
            // Test with invalid counter percentage
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/admin/commissions/${commission._id}/respond`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                action: 'counter',
                counterPercentage: 0,
                notes: 'Invalid counter'
            });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('greater than 0');
        });
        it('should prevent responding to finalized commission', async () => {
            const commission = await Commission_1.Commission.create({
                managerId: new mongoose_1.default.Types.ObjectId(),
                serviceId: new mongoose_1.default.Types.ObjectId(),
                offeredPercentage: 20,
                status: 'accepted'
            });
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/admin/commissions/${commission._id}/respond`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                action: 'counter',
                counterPercentage: 15,
                notes: 'Try to counter finalized commission'
            });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('already been finalized');
        });
    });
    describe('Manager Commission Response', () => {
        let negotiatingCommissionId;
        beforeEach(async () => {
            // Create a commission in negotiating state
            const commission = await Commission_1.Commission.create({
                managerId: new mongoose_1.default.Types.ObjectId(),
                serviceId: new mongoose_1.default.Types.ObjectId(),
                offeredPercentage: 20,
                status: 'negotiating',
                adminCounterPercentage: 15,
                type: 'admin_counter'
            });
            negotiatingCommissionId = commission._id.toString();
        });
        it('should accept admin counter offer', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/manager/commissions/${negotiatingCommissionId}/respond`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                response: 'accept',
                notes: 'Accepting admin counter offer'
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('accepted');
            expect(res.body.data.finalPercentage).toBe(15);
        });
        it('should reject admin counter offer', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/manager/commissions/${negotiatingCommissionId}/respond`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                response: 'reject',
                notes: 'Cannot accept this rate'
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('rejected');
        });
        it('should counter admin offer', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/manager/commissions/${negotiatingCommissionId}/respond`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                response: 'counter',
                counterPercentage: 18,
                notes: 'Counter with 18%'
            });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('pending');
            expect(res.body.data.offeredPercentage).toBe(18);
            expect(res.body.data.adminCounterPercentage).toBeUndefined();
        });
        it('should validate counter percentage in manager response', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/manager/commissions/${negotiatingCommissionId}/respond`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                response: 'counter',
                counterPercentage: 0,
                notes: 'Invalid counter'
            });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('greater than 0');
        });
        it('should prevent response when no admin counter exists', async () => {
            const pendingCommission = await Commission_1.Commission.create({
                managerId: new mongoose_1.default.Types.ObjectId(),
                serviceId: new mongoose_1.default.Types.ObjectId(),
                offeredPercentage: 20,
                status: 'pending'
            });
            const res = await (0, supertest_1.default)(index_1.default)
                .patch(`/api/v1/manager/commissions/${pendingCommission._id}/respond`)
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                response: 'accept',
                notes: 'Trying to accept without counter'
            });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('No admin counter offer to respond to');
        });
    });
    describe('Commission Statistics', () => {
        it('should get commission stats', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .get('/api/v1/admin/commissions/stats')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('byStatus');
            expect(res.body.data).toHaveProperty('totalStats');
        });
        it('should get pending commissions', async () => {
            const res = await (0, supertest_1.default)(index_1.default)
                .get('/api/v1/admin/commissions/pending')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('items');
        });
    });
});
