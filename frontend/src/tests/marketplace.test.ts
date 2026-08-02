import indexedDB from 'fake-indexeddb';
import IDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

// Set IndexedDB globals BEFORE importing Dexie
(globalThis as unknown as Record<string, unknown>).indexedDB = indexedDB;
(globalThis as unknown as Record<string, unknown>).IDBKeyRange = IDBKeyRange;

import { describe, it, expect, beforeAll } from 'bun:test';
import { PackageValidator } from '../services/packageValidator';
import { PaymentService } from '../services/paymentService';

describe('Dokion Marketplace Integration Tests', () => {
  let MarketplaceService: typeof import('../services/marketplaceService').MarketplaceService;
  let DokionCliApi: typeof import('../services/cliApi').DokionCliApi;

  beforeAll(async () => {
    const serviceMod = await import('../services/marketplaceService');
    const cliMod = await import('../services/cliApi');
    MarketplaceService = serviceMod.MarketplaceService;
    DokionCliApi = cliMod.DokionCliApi;
    await MarketplaceService.init();
  });

  describe('PackageValidator Tests', () => {
    it('validates a correct playbook manifest', () => {
      const yaml = `schema_version: 1\nslug: test-playbook\nversion: 1.0.0`;
      const res = PackageValidator.validateManifest(yaml);
      expect(res.valid).toBe(true);
      expect(res.permissions.length).toBeGreaterThan(0);
    });

    it('rejects manifest missing schema_version', () => {
      const yaml = `slug: test-playbook\nversion: 1.0.0`;
      const res = PackageValidator.validateManifest(yaml);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('schema_version');
    });

    it('detects directory traversal attack in package archive files', async () => {
      const val = await PackageValidator.runFullValidation({
        versionId: 'ver-test',
        playbookSlug: 'test-playbook',
        manifestContent: `schema_version: 1\nslug: test-playbook\nversion: 1.0.0`,
        files: [
          { path: '../../etc/passwd', type: 'yaml', size: 100 }
        ],
        packageSizeBytes: 100
      });
      expect(val.passed).toBe(false);
      const archiveStep = val.steps.find(s => s.step === 'archive');
      expect(archiveStep?.status).toBe('failed');
    });
  });

  describe('PaymentService & Licensing Tests', () => {
    it('generates valid formatted license keys', () => {
      const key = PaymentService.generateLicenseKey('secure-api');
      expect(key).toContain('DOKION-SECU-');
    });

    it('generates and verifies signed download tokens', () => {
      const token = PaymentService.generateSignedDownloadToken('secure-api-review', 'DOKION-LIC-1234');
      expect(token.startsWith('dl_tok_')).toBe(true);

      const verified = PaymentService.verifyDownloadToken(token);
      expect(verified.valid).toBe(true);
      expect(verified.playbookSlug).toBe('secure-api-review');
    });

    it('handles webhook idempotency cleanly', async () => {
      const eventId = 'evt_test_12345';
      const first = await PaymentService.handleWebhook(eventId, { type: 'payment_intent.succeeded' });
      expect(first.duplicate).toBe(false);

      const second = await PaymentService.handleWebhook(eventId, { type: 'payment_intent.succeeded' });
      expect(second.duplicate).toBe(true);
    });
  });

  describe('DokionCliApi Registry Integration Tests', () => {
    it('searches playbooks via CLI API', async () => {
      const res = await DokionCliApi.search('security');
      expect(res.success).toBe(true);
      expect(res.playbooks.length).toBeGreaterThan(0);
    });

    it('fetches playbook info via CLI API', async () => {
      const res = await DokionCliApi.info('secure-api-review');
      expect(res.success).toBe(true);
      expect(res.playbook.slug).toBe('secure-api-review');
    });
  });
});
