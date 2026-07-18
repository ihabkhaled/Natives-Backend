import { Injectable } from '@nestjs/common';

import { NotificationChannel } from '../model/platform.enums';
import type {
  Notification,
  NotificationSenderPort,
  SendResult,
} from '../model/platform.types';

/**
 * In-app channel adapter. For the in-app inbox, persisting the notification row
 * *is* the delivery, so sending always succeeds and records a delivered attempt.
 * This is the only channel in this slice; email/push adapters bind the same port
 * later and wrap their own vendor SDK behind this seam.
 */
@Injectable()
export class InAppNotificationAdapter implements NotificationSenderPort {
  readonly channel = NotificationChannel.InApp;

  send(notification: Notification): SendResult {
    return { notificationId: notification.id, delivered: true, error: null };
  }
}
