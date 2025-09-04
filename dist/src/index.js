"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const socket_io_1 = require("socket.io");
const env_1 = require("./config/env");
const auth_1 = __importDefault(require("./routes/auth"));
const profile_1 = __importDefault(require("./routes/profile"));
const services_1 = __importDefault(require("./routes/services"));
const categories_1 = __importDefault(require("./routes/categories"));
const cart_1 = __importDefault(require("./routes/cart"));
const orders_1 = __importDefault(require("./routes/orders"));
const uploads_1 = __importDefault(require("./routes/uploads"));
const chat_1 = __importDefault(require("./routes/chat"));
const manager_test_1 = __importDefault(require("./routes/manager-test"));
const admin_1 = __importDefault(require("./routes/admin"));
const requirements_1 = __importDefault(require("./routes/requirements"));
const areas_1 = __importDefault(require("./routes/areas"));
const Chat_1 = require("./models/Chat");
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '5mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN, credentials: true }));
const limiter = (0, express_rate_limit_1.default)({ windowMs: 60 * 1000, max: 120 });
app.use('/api/', limiter);
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/profile', profile_1.default);
app.use('/api/v1/services', services_1.default);
app.use('/api/v1/categories', categories_1.default);
app.use('/api/v1/cart', cart_1.default);
app.use('/api/v1/orders', orders_1.default);
app.use('/api/v1/uploads', uploads_1.default);
app.use('/api/v1/chat', chat_1.default);
app.use('/api/v1/manager', manager_test_1.default);
app.use('/api/v1/admin', admin_1.default);
app.use('/api/v1/requirements', requirements_1.default);
app.use('/api/v1/areas', areas_1.default);
// Serve uploaded files
app.use('/uploads', express_1.default.static('uploads'));
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: env_1.env.CORS_ORIGIN } });
// Enhanced Socket.io handling
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token)
        return next(new Error('Authentication error'));
    try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(token, env_1.env.JWT_ACCESS_SECRET);
        socket.userId = payload._id;
        socket.userRole = payload.role;
        next();
    }
    catch {
        next(new Error('Authentication error'));
    }
});
io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected`);
    socket.on('join', ({ chatId }) => {
        if (chatId) {
            socket.join(`chat:${chatId}`);
            console.log(`User ${socket.userId} joined chat:${chatId}`);
        }
    });
    socket.on('message', async ({ chatId, type, content, mediaUrl }) => {
        try {
            const message = new Chat_1.MessageModel({
                chatId,
                senderId: socket.userId,
                type: type || 'text',
                content,
                mediaUrl,
                readBy: [socket.userId],
            });
            await message.save();
            // Broadcast to chat room
            io.to(`chat:${chatId}`).emit('message:new', message);
            // Update chat lastMessageAt
            const { ChatModel } = require('./models/Chat');
            await ChatModel.findByIdAndUpdate(chatId, {
                lastMessageAt: new Date().toISOString()
            });
        }
        catch (error) {
            socket.emit('error', { message: 'Failed to send message' });
        }
    });
    socket.on('read', async ({ chatId, messageIds }) => {
        try {
            await Chat_1.MessageModel.updateMany({ _id: { $in: messageIds }, chatId }, { $addToSet: { readBy: socket.userId } });
            socket.to(`chat:${chatId}`).emit('message:read', { messageIds, readBy: socket.userId });
        }
        catch (error) {
            socket.emit('error', { message: 'Failed to mark as read' });
        }
    });
    socket.on('typing', ({ chatId, isTyping }) => {
        socket.to(`chat:${chatId}`).emit('chat:typing', {
            userId: socket.userId,
            isTyping
        });
    });
    socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
    });
});
async function start() {
    try {
        // Enhanced MongoDB connection options
        await mongoose_1.default.connect(env_1.env.MONGO_URI, {
            serverSelectionTimeoutMS: 30000, // 30 seconds timeout
            socketTimeoutMS: 45000, // 45 seconds socket timeout
            retryWrites: true,
            retryReads: true,
            maxPoolSize: 10,
            minPoolSize: 2,
            bufferCommands: false,
        });
        console.log('Connected to MongoDB Atlas successfully');
        const PORT = Number(process.env.PORT) || env_1.env.PORT;
        const HOST = env_1.env.HOST;
        server.listen(PORT, HOST, () => {
            console.log(`API listening on ${HOST}:${PORT}`);
            console.log(`Health check available at http://${HOST}:${PORT}/health`);
        });
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        // Check if it's a network access issue
        if (error instanceof Error && error.message && error.message.includes('IP')) {
            console.error('IP Whitelist Error: Please add your current IP address to MongoDB Atlas Network Access');
            console.error('Go to: https://cloud.mongodb.com/v2/[PROJECT_ID]#security/network/whitelist');
        }
        throw error;
    }
}
start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', err);
    process.exit(1);
});
// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        mongoose_1.default.connection.close().then(() => {
            console.log('MongoDB connection closed.');
            process.exit(0);
        });
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        mongoose_1.default.connection.close().then(() => {
            console.log('MongoDB connection closed.');
            process.exit(0);
        });
    });
});
exports.default = app;
