export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  message: string;
  timestamp: Date;
  read: boolean;
  sender_type: 'passenger' | 'driver';
}

/**
 * A chat thread tied to a single booking, summarised for the Inbox list.
 * The "other" party is whoever the current user is talking to (their driver
 * if the user is a passenger, or their passenger if the user is a driver).
 */
export interface Conversation {
  bookingId: string;
  otherUserId: string | null;
  otherName: string;
  otherPhoto: string | null;
  otherType: 'passenger' | 'driver';
  lastMessage: string | null;
  lastTimestamp: string;
  unreadCount: number;
  bookingStatus: 'pending' | 'accepted' | 'in-transit' | 'completed' | 'cancelled';
  /** Active threads (accepted / in-transit) sort to the top and stay open. */
  active: boolean;
}
