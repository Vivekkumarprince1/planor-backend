import mongoose, { Document, Schema } from 'mongoose';

// Local type definitions
type MessageType = 'text' | 'image' | 'file';

interface ChatType {
  _id: string;
  orderId?: string;
  userId: string;
  managerId: string;
  participants: string[];
  lastMessageAt: string;
}

interface MessageType_Interface {
  _id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  createdAt: string;
  readBy?: string[];
}

export interface ChatDocument extends Omit<ChatType, '_id'>, Document {}
export interface MessageDocument extends Omit<MessageType_Interface, '_id'>, Document {}

const chatSchema = new Schema<ChatDocument>({
  orderId: String,
  userId: { type: String, required: true },
  managerId: { type: String, required: true },
  participants: [String],
  lastMessageAt: { type: String, default: () => new Date().toISOString() },
}, {
  timestamps: true,
});

const messageSchema = new Schema<MessageDocument>({
  chatId: { type: String, required: true },
  senderId: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  content: String,
  mediaUrl: String,
  readBy: [String],
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

chatSchema.index({ userId: 1, managerId: 1 });
chatSchema.index({ participants: 1 });
messageSchema.index({ chatId: 1, createdAt: -1 });

export const ChatModel = mongoose.model<ChatDocument>('Chat', chatSchema);
export const MessageModel = mongoose.model<MessageDocument>('Message', messageSchema);
