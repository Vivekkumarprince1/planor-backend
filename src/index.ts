import http from 'http';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import servicesRoutes from './routes/services';
import categoriesRoutes from './routes/categories';
import cartRoutes from './routes/cart';
import ordersRoutes from './routes/orders';
import uploadsRoutes from './routes/uploads';
import chatRoutes from './routes/chat';
import managerRoutes from './routes/manager-test';
import adminRoutes from './routes/admin';
import requirementsRoutes from './routes/requirements';
import areasRoutes from './routes/areas';
import { MessageModel } from './models/Chat';
import { auth, AuthPayload } from './middleware/auth';

const app = express();

// Trust proxy when running behind a reverse proxy (like Render)
app.set('trust proxy', 1);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api/', limiter);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', ordersRoutes);
app.use('/api/v1/uploads', uploadsRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/manager', managerRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/requirements', requirementsRoutes);
app.use('/api/v1/areas', areasRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: env.CORS_ORIGIN } });

// Enhanced Socket.io handling
io.use((socket: any, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
    socket.userId = payload._id;
    socket.userRole = payload.role;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket: any) => {
  console.log(`User ${socket.userId} connected`);

  socket.on('join', ({ chatId }: { chatId: string }) => {
    if (chatId) {
      socket.join(`chat:${chatId}`);
      console.log(`User ${socket.userId} joined chat:${chatId}`);
    }
  });

  socket.on('message', async ({ chatId, type, content, mediaUrl }: any) => {
    try {
      const message = new MessageModel({
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
      
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('read', async ({ chatId, messageIds }: any) => {
    try {
      await MessageModel.updateMany(
        { _id: { $in: messageIds }, chatId },
        { $addToSet: { readBy: socket.userId } }
      );
      
      socket.to(`chat:${chatId}`).emit('message:read', { messageIds, readBy: socket.userId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to mark as read' });
    }
  });

  socket.on('typing', ({ chatId, isTyping }: any) => {
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
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,
      minPoolSize: 2,
      bufferCommands: false,
    });
    
    console.log('Connected to MongoDB Atlas successfully');
    
    const PORT = Number(process.env.PORT) || env.PORT;
    const HOST = env.HOST;
    
    server.listen(PORT, HOST, () => {
      console.log(`API listening on ${HOST}:${PORT}`);
      console.log(`Health check available at http://${HOST}:${PORT}/health`);
    });
  } catch (error) {
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
    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close().then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
});

export default app;