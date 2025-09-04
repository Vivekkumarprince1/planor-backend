"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionService = void 0;
const mongoose_1 = require("mongoose");
const Commission_1 = require("../models/Commission");
const Service_1 = require("../models/Service");
const Order_1 = require("../models/Order");
class CommissionService {
    /**
     * Get effective commission percentage for a service
     */
    static async getEffectiveCommission(serviceId) {
        try {
            const service = await Service_1.Service.findById(serviceId).populate('commissionId');
            if (!service) {
                return 0;
            }
            // If there's a specific commission agreement for this service
            if (service.commissionId && service.finalCommissionPercentage !== undefined) {
                return service.finalCommissionPercentage;
            }
            // If service has agreed commission but no specific commission document
            if (service.commissionStatus === 'agreed' && service.finalCommissionPercentage !== undefined) {
                return service.finalCommissionPercentage;
            }
            // Look for active commission agreements
            const commission = await Commission_1.Commission.findOne({
                $or: [
                    { serviceId: serviceId }, // Service-specific commission
                    { serviceId: { $exists: false }, managerId: service.managerId } // Global manager commission
                ],
                status: 'accepted',
                isActive: true,
                $and: [
                    {
                        $or: [
                            { validUntil: { $exists: false } }, // No expiry
                            { validUntil: { $gte: new Date() } } // Not expired
                        ]
                    }
                ]
            }).sort({ serviceId: -1, createdAt: -1 }); // Prefer service-specific over global
            if (commission) {
                return commission.getEffectivePercentage();
            }
            return 0;
        }
        catch (error) {
            console.error('Error getting effective commission:', error);
            return 0;
        }
    }
    /**
     * Calculate commission for an order
     */
    static async calculateOrderCommission(orderId) {
        try {
            const order = await Order_1.OrderModel.findById(orderId).populate('serviceId');
            if (!order || !order.serviceId) {
                return null;
            }
            const serviceId = order.serviceId?._id || order.serviceId;
            const commissionPercentage = await this.getEffectiveCommission(serviceId);
            if (commissionPercentage <= 0) {
                return {
                    serviceId: serviceId.toString(),
                    orderId: order._id.toString(),
                    servicePrice: order.totalAmount,
                    commissionPercentage: 0,
                    commissionAmount: 0,
                    finalAmount: order.totalAmount
                };
            }
            const commissionAmount = (order.totalAmount * commissionPercentage) / 100;
            const finalAmount = order.totalAmount - commissionAmount;
            return {
                serviceId: serviceId.toString(),
                orderId: order._id.toString(),
                servicePrice: order.totalAmount,
                commissionPercentage,
                commissionAmount: Math.round(commissionAmount * 100) / 100, // Round to 2 decimal places
                finalAmount: Math.round(finalAmount * 100) / 100
            };
        }
        catch (error) {
            console.error('Error calculating order commission:', error);
            return null;
        }
    }
    /**
     * Get commission summary for a manager
     */
    static async getManagerCommissionSummary(managerId) {
        try {
            const [commissionStats, orderStats] = await Promise.all([
                // Commission agreements stats
                Commission_1.Commission.aggregate([
                    { $match: { managerId: new mongoose_1.Types.ObjectId(managerId) } },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                            avgPercentage: { $avg: '$offeredPercentage' },
                            avgFinalPercentage: { $avg: '$finalPercentage' }
                        }
                    }
                ]),
                // Order commission stats
                Order_1.OrderModel.aggregate([
                    {
                        $lookup: {
                            from: 'services',
                            localField: 'serviceId',
                            foreignField: '_id',
                            as: 'service'
                        }
                    },
                    { $unwind: '$service' },
                    { $match: { 'service.managerId': new mongoose_1.Types.ObjectId(managerId) } },
                    {
                        $group: {
                            _id: null,
                            totalOrders: { $sum: 1 },
                            totalRevenue: { $sum: '$totalAmount' },
                            avgOrderValue: { $avg: '$totalAmount' }
                        }
                    }
                ])
            ]);
            // Get active commissions
            const activeCommissions = await Commission_1.Commission.find({
                managerId,
                status: 'accepted',
                isActive: true
            }).populate('serviceId', 'title');
            return {
                commissionAgreements: commissionStats.reduce((acc, stat) => {
                    acc[stat._id] = {
                        count: stat.count,
                        avgPercentage: stat.avgPercentage,
                        avgFinalPercentage: stat.avgFinalPercentage
                    };
                    return acc;
                }, {}),
                orderStats: orderStats[0] || { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 },
                activeCommissions: activeCommissions.map(c => ({
                    id: c._id,
                    serviceId: c.serviceId?._id,
                    serviceTitle: c.serviceId?.title,
                    percentage: c.getEffectivePercentage(),
                    validUntil: c.validUntil
                }))
            };
        }
        catch (error) {
            console.error('Error getting manager commission summary:', error);
            throw error;
        }
    }
    /**
     * Create or update commission agreement
     */
    static async createCommissionOffer(data) {
        try {
            // Check if there's already an active commission for this service/manager combination
            const existingCommission = await Commission_1.Commission.findOne({
                managerId: data.managerId,
                serviceId: data.serviceId || { $exists: false },
                status: { $in: ['pending', 'accepted'] },
                isActive: true
            });
            if (existingCommission && existingCommission.status === 'accepted') {
                throw new Error('An active commission agreement already exists for this service');
            }
            if (existingCommission && existingCommission.status === 'pending') {
                // Update existing pending commission
                existingCommission.offeredPercentage = data.offeredPercentage;
                existingCommission.validUntil = data.validUntil;
                existingCommission.minOrderValue = data.minOrderValue;
                existingCommission.maxOrderValue = data.maxOrderValue;
                existingCommission.addNegotiationEntry('offer_updated', new mongoose_1.Types.ObjectId(data.managerId), 'manager', data.offeredPercentage, data.notes);
                await existingCommission.save();
                return existingCommission;
            }
            // Create new commission
            const commission = new Commission_1.Commission({
                managerId: data.managerId,
                serviceId: data.serviceId,
                offeredPercentage: data.offeredPercentage,
                status: 'pending',
                type: 'manager_offer',
                validUntil: data.validUntil,
                minOrderValue: data.minOrderValue,
                maxOrderValue: data.maxOrderValue
            });
            commission.addNegotiationEntry('offer', new mongoose_1.Types.ObjectId(data.managerId), 'manager', data.offeredPercentage, data.notes);
            await commission.save();
            return commission;
        }
        catch (error) {
            console.error('Error creating commission offer:', error);
            throw error;
        }
    }
    /**
     * Get commission history for analytics
     */
    static async getCommissionAnalytics(filter = {}) {
        try {
            const matchStage = {};
            if (filter.managerId)
                matchStage.managerId = new mongoose_1.Types.ObjectId(filter.managerId);
            if (filter.serviceId)
                matchStage.serviceId = new mongoose_1.Types.ObjectId(filter.serviceId);
            if (filter.dateFrom || filter.dateTo) {
                matchStage.createdAt = {};
                if (filter.dateFrom)
                    matchStage.createdAt.$gte = filter.dateFrom;
                if (filter.dateTo)
                    matchStage.createdAt.$lte = filter.dateTo;
            }
            const analytics = await Commission_1.Commission.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: {
                            status: '$status',
                            month: { $month: '$createdAt' },
                            year: { $year: '$createdAt' }
                        },
                        count: { $sum: 1 },
                        avgOfferedPercentage: { $avg: '$offeredPercentage' },
                        avgCounterPercentage: { $avg: '$adminCounterPercentage' },
                        avgFinalPercentage: { $avg: '$finalPercentage' }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } }
            ]);
            return analytics;
        }
        catch (error) {
            console.error('Error getting commission analytics:', error);
            throw error;
        }
    }
}
exports.CommissionService = CommissionService;
