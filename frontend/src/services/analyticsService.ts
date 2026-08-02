export interface AnalyticsEvent {
  eventName: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

class PrivacyAnalyticsService {
  private events: AnalyticsEvent[] = [];

  track(eventName: string, properties: Record<string, unknown> = {}) {
    // Redact sensitive data
    const sanitizedProps = { ...properties };
    delete sanitizedProps.password;
    delete sanitizedProps.secret;
    delete sanitizedProps.creditCard;
    delete sanitizedProps.apiKey;

    const event: AnalyticsEvent = {
      eventName,
      properties: sanitizedProps,
      timestamp: Date.now()
    };

    this.events.push(event);
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${eventName}:`, sanitizedProps);
    }
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
}

export const analytics = new PrivacyAnalyticsService();
