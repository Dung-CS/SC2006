import { DeliveryOutcome } from '../../entity/enums';

export interface AlertPayload {
  message: string;
  /** Required by external channels; in-app channels can ignore it. */
  recipientId?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface INotificationChannelStrategy {
  sendNotification(alert: AlertPayload): Promise<boolean>;
}

export type NotificationChannelPreference = 'telegram' | 'in-app' | 'recording';

export interface NotificationDeliveryChannel {
  send(chatId: string, text: string): Promise<DeliveryOutcome>;
}
