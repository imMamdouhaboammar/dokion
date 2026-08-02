import { db } from '../db';
import type { LicenseRecord, OrderRecord } from '../types/marketplace';

export interface CheckoutRequest {
  userId: string;
  playbookId: string;
  playbookSlug: string;
  playbookTitle: string;
  priceUsdCents: number;
  paymentMethod: 'card_test' | 'dokion_tokens';
}

export interface CheckoutResult {
  success: boolean;
  order?: OrderRecord;
  license?: LicenseRecord;
  downloadToken?: string;
  error?: string;
}

export class PaymentService {
  static generateLicenseKey(slug: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randChunk = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `DOKION-${slug.substring(0, 4).toUpperCase()}-${randChunk(4)}-${randChunk(4)}-${randChunk(4)}`;
  }

  static generateSignedDownloadToken(playbookSlug: string, licenseKey: string): string {
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins
    const raw = `${playbookSlug}:${licenseKey}:${expiresAt}`;
    const b64 = btoa(raw);
    return `dl_tok_${b64}`;
  }

  static verifyDownloadToken(token: string): { valid: boolean; playbookSlug?: string; licenseKey?: string; expired?: boolean } {
    try {
      if (!token.startsWith('dl_tok_')) return { valid: false };
      const raw = atob(token.replace('dl_tok_', ''));
      const [playbookSlug, licenseKey, expiresStr] = raw.split(':');
      const expiresAt = parseInt(expiresStr, 10);
      if (Date.now() > expiresAt) {
        return { valid: false, expired: true, playbookSlug, licenseKey };
      }
      return { valid: true, playbookSlug, licenseKey };
    } catch {
      return { valid: false };
    }
  }

  static async processCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    try {
      const existingLicense = await db.licenses
        .where('userId')
        .equals(req.userId)
        .and(l => l.playbookSlug === req.playbookSlug && l.status === 'active')
        .first();

      if (existingLicense) {
        const downloadToken = this.generateSignedDownloadToken(req.playbookSlug, existingLicense.licenseKey);
        return {
          success: true,
          license: existingLicense,
          downloadToken
        };
      }

      const orderId = `ord-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
      const licenseKey = this.generateLicenseKey(req.playbookSlug);

      const order: OrderRecord = {
        id: orderId,
        userId: req.userId,
        playbookId: req.playbookId,
        playbookTitle: req.playbookTitle,
        amountCents: req.priceUsdCents,
        currency: 'USD',
        status: 'completed',
        paymentProvider: 'stripe_test',
        providerTransactionId: `tx_test_${Date.now().toString(36)}`,
        licenseKey,
        createdAt: Date.now()
      };

      const license: LicenseRecord = {
        id: `lic-${Date.now().toString(36)}`,
        licenseKey,
        userId: req.userId,
        playbookId: req.playbookId,
        playbookSlug: req.playbookSlug,
        version: '1.0.0',
        orderId,
        seats: 1,
        status: 'active',
        createdAt: Date.now()
      };

      await db.orders.put(order);
      await db.licenses.put(license);

      // Increment publisher balance & total sales
      const listing = await db.playbookListings.get(req.playbookId);
      if (listing) {
        await db.playbookListings.update(req.playbookId, {
          downloadCount: listing.downloadCount + 1,
          updatedAt: Date.now()
        });

        const publisher = await db.publishers.get(listing.publisherId);
        if (publisher) {
          const netEarned = Math.round(req.priceUsdCents * (1 - publisher.commissionRate));
          await db.publishers.update(listing.publisherId, {
            balanceCents: publisher.balanceCents + netEarned,
            totalSalesCents: publisher.totalSalesCents + req.priceUsdCents,
            totalDownloads: publisher.totalDownloads + 1,
            updatedAt: Date.now()
          });
        }
      }

      const downloadToken = this.generateSignedDownloadToken(req.playbookSlug, licenseKey);

      return {
        success: true,
        order,
        license,
        downloadToken
      };
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Checkout processing failed';
      return { success: false, error: err };
    }
  }

  static async handleWebhook(eventId: string, payload: Record<string, unknown>): Promise<{ success: boolean; duplicate: boolean }> {
    const existing = await db.webhooks.where('providerEventId').equals(eventId).first();
    if (existing) {
      return { success: true, duplicate: true };
    }

    await db.webhooks.put({
      id: `wh-${Date.now().toString(36)}`,
      providerEventId: eventId,
      eventType: (payload.type as string) || 'payment_intent.succeeded',
      processed: true,
      payload,
      receivedAt: Date.now()
    });

    return { success: true, duplicate: false };
  }
}
