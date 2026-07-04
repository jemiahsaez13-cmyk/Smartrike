import { MessageRepository } from '@/models/repositories/MessageRepository';
import { Conversation, Message } from '@/models/types';

const repo = new MessageRepository();

export class MessageService {
  async sendMessage(
    bookingId: string,
    senderId: string,
    senderType: 'passenger' | 'driver',
    text: string
  ): Promise<Message> {
    if (!text.trim()) throw new Error('Message cannot be empty');
    return repo.sendMessage({
      booking_id: bookingId,
      sender_id: senderId,
      sender_type: senderType,
      message: text.trim(),
      read: false,
    });
  }

  async getMessages(bookingId: string): Promise<Message[]> {
    return repo.findByBooking(bookingId);
  }

  async markRead(messageId: string): Promise<void> {
    return repo.markRead(messageId);
  }

  async markAllRead(bookingId: string, myType: 'passenger' | 'driver', userId?: string): Promise<void> {
    return repo.markAllReadForBooking(bookingId, myType, userId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return repo.getUnreadCount(userId);
  }

  async getUnreadCountForBooking(bookingId: string, userId: string): Promise<number> {
    return repo.getUnreadCountForBooking(bookingId, userId);
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    return repo.getConversations(userId);
  }

  async deleteConversation(bookingId: string): Promise<void> {
    return repo.deleteConversation(bookingId);
  }
}
