"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Review_1 = require("../models/Review");
const Order_1 = require("../models/Order");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// Validation schemas
const createReviewSchema = zod_1.z.object({
    orderId: zod_1.z.string(),
    serviceId: zod_1.z.string(),
    rating: zod_1.z.number().min(1).max(5),
    comment: zod_1.z.string().optional(),
});
const updateReviewStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['approved', 'rejected']),
    adminNotes: zod_1.z.string().optional(),
});
// POST /api/reviews - Create a review (only for users who have completed orders)
router.post('/reviews', auth_1.auth, async (req, res) => {
    try {
        const validatedData = createReviewSchema.parse(req.body);
        const { orderId, serviceId, rating, comment } = validatedData;
        // Verify the user has a completed order for this service
        const order = await Order_1.OrderModel.findOne({
            _id: orderId,
            userId: req.user._id,
            status: 'completed',
            'items.serviceId': serviceId
        });
        if (!order) {
            return res.status(403).json({
                success: false,
                error: 'You can only review services from your completed orders'
            });
        }
        // Check if user already reviewed this service
        const existingReview = await Review_1.ReviewModel.findOne({
            userId: req.user._id,
            serviceId: serviceId
        });
        if (existingReview) {
            return res.status(400).json({
                success: false,
                error: 'You have already reviewed this service'
            });
        }
        // Create the review
        const review = await Review_1.ReviewModel.create({
            orderId,
            serviceId,
            userId: req.user._id,
            rating,
            comment,
            status: 'pending'
        });
        res.status(201).json({
            success: true,
            data: review,
            message: 'Review submitted for admin approval'
        });
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid review data',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to create review'
        });
    }
});
// GET /api/reviews/service/:serviceId - Get approved reviews for a service
router.get('/reviews/service/:serviceId', async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const reviews = await Review_1.ReviewModel.find({
            serviceId,
            status: 'approved'
        })
            .populate('userId', 'name')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        const total = await Review_1.ReviewModel.countDocuments({
            serviceId,
            status: 'approved'
        });
        // Calculate average rating
        const ratingStats = await Review_1.ReviewModel.aggregate([
            { $match: { serviceId, status: 'approved' } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    ratingDistribution: {
                        $push: '$rating'
                    }
                }
            }
        ]);
        const stats = ratingStats[0] || {
            averageRating: 0,
            totalReviews: 0,
            ratingDistribution: []
        };
        // Calculate rating distribution
        const distribution = [1, 2, 3, 4, 5].map(rating => ({
            rating,
            count: stats.ratingDistribution.filter((r) => r === rating).length
        }));
        res.json({
            success: true,
            data: {
                reviews,
                stats: {
                    averageRating: Math.round(stats.averageRating * 10) / 10,
                    totalReviews: stats.totalReviews,
                    distribution
                },
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reviews'
        });
    }
});
// GET /api/reviews/my - Get user's reviews
router.get('/reviews/my', auth_1.auth, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const reviews = await Review_1.ReviewModel.find({ userId: req.user._id })
            .populate('serviceId', 'title')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        const total = await Review_1.ReviewModel.countDocuments({ userId: req.user._id });
        res.json({
            success: true,
            data: {
                reviews,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch your reviews'
        });
    }
});
// GET /api/reviews/can-review/:serviceId - Check if user can review a service
router.get('/reviews/can-review/:serviceId', auth_1.auth, async (req, res) => {
    try {
        const { serviceId } = req.params;
        // Check if user has completed order for this service
        const completedOrder = await Order_1.OrderModel.findOne({
            userId: req.user._id,
            status: 'completed',
            'items.serviceId': serviceId
        });
        // Check if user already reviewed this service
        const existingReview = await Review_1.ReviewModel.findOne({
            userId: req.user._id,
            serviceId: serviceId
        });
        res.json({
            success: true,
            data: {
                canReview: !!completedOrder && !existingReview,
                hasCompletedOrder: !!completedOrder,
                hasExistingReview: !!existingReview,
                orderId: completedOrder?._id
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to check review eligibility'
        });
    }
});
// Admin routes
// GET /api/admin/reviews - Get all reviews for admin
router.get('/admin/reviews', auth_1.auth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'pending', serviceId, userId } = req.query;
        const filter = {};
        if (status)
            filter.status = status;
        if (serviceId)
            filter.serviceId = serviceId;
        if (userId)
            filter.userId = userId;
        const reviews = await Review_1.ReviewModel.find(filter)
            .populate('userId', 'name email')
            .populate('serviceId', 'title')
            .populate('orderId')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
        const total = await Review_1.ReviewModel.countDocuments(filter);
        res.json({
            success: true,
            data: {
                reviews,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reviews'
        });
    }
});
// PATCH /api/admin/reviews/:id/status - Update review status
router.patch('/admin/reviews/:id/status', auth_1.auth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const validatedData = updateReviewStatusSchema.parse(req.body);
        const { status, adminNotes } = validatedData;
        const review = await Review_1.ReviewModel.findByIdAndUpdate(id, {
            status,
            adminNotes,
            reviewedAt: new Date(),
            reviewedBy: req.user._id
        }, { new: true }).populate('userId', 'name')
            .populate('serviceId', 'title');
        if (!review) {
            return res.status(404).json({
                success: false,
                error: 'Review not found'
            });
        }
        res.json({
            success: true,
            data: review,
            message: `Review ${status === 'approved' ? 'approved' : 'rejected'} successfully`
        });
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid request data',
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to update review status'
        });
    }
});
// GET /api/admin/reviews/stats - Get review statistics
router.get('/admin/reviews/stats', auth_1.auth, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const stats = await Review_1.ReviewModel.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        const totalReviews = await Review_1.ReviewModel.countDocuments();
        const avgRating = await Review_1.ReviewModel.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: null, average: { $avg: '$rating' } } }
        ]);
        const formattedStats = {
            total: totalReviews,
            pending: stats.find(s => s._id === 'pending')?.count || 0,
            approved: stats.find(s => s._id === 'approved')?.count || 0,
            rejected: stats.find(s => s._id === 'rejected')?.count || 0,
            averageRating: avgRating[0]?.average || 0
        };
        res.json({
            success: true,
            data: formattedStats
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch review statistics'
        });
    }
});
exports.default = router;
