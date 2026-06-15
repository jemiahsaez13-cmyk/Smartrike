import { MessageRepository } from '@/models/repositories/MessageRepository';
import { Message } from '@/models/types';

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

  async markAllRead(bookingId: string, myType: 'passenger' | 'driver'): Promise<void> {
    return repo.markAllReadForBooking(bookingId, myType);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return repo.getUnreadCount(userId);
  }
}
