import { DeliveryOutcome } from '../../entity/enums';
import {
  AlertPayload,
  INotificationChannelStrategy,
  NotificationChannelPreference,
  NotificationDeliveryChannel,
} from './INotificationChannelStrategy';

export class TelegramChannelStrategy implements INotificationChannelStrategy {
  constructor(private readonly channel: NotificationDeliveryChannel) {}

  async sendNotification(alert: AlertPayload): Promise<boolean> {
    if (!alert.recipientId) return false;
    return (await this.channel.send(alert.recipientId, alert.message)) === DeliveryOutcome.Sent;
  }
}

export class InAppAlertChannelStrategy implements INotificationChannelStrategy {
  constructor(private readonly publish: (alert: AlertPayload) => Promise<void> | void) {}

  async sendNotification(alert: AlertPayload): Promise<boolean> {
    await this.publish(alert);
    return true;
  }
}

export class RecordingChannelStrategy implements INotificationChannelStrategy {
  readonly sent: AlertPayload[] = [];
  constructor(private readonly succeeds = true) {}

  async sendNotification(alert: AlertPayload): Promise<boolean> {
    this.sent.push({ ...alert });
    return this.succeeds;
  }
}

export class NotificationChannelFactory {
  static create(
    preference: NotificationChannelPreference,
    options: {
      telegram?: NotificationDeliveryChannel;
      publishInApp?: (alert: AlertPayload) => Promise<void> | void;
      recordingSucceeds?: boolean;
    } = {},
  ): INotificationChannelStrategy {
    switch (preference) {
      case 'telegram':
        if (!options.telegram) throw new Error('Telegram channel is required for Telegram notifications');
        return new TelegramChannelStrategy(options.telegram);
      case 'in-app':
        if (!options.publishInApp) throw new Error('In-app publisher is required for in-app notifications');
        return new InAppAlertChannelStrategy(options.publishInApp);
      case 'recording':
        return new RecordingChannelStrategy(options.recordingSucceeds);
    }
  }
}
