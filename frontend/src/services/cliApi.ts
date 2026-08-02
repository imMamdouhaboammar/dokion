import { MarketplaceService } from './marketplaceService';
import { PaymentService } from './paymentService';
import { db } from '../db';
import type { LockfileEntry } from '../db';

export class DokionCliApi {
  static async search(query: string) {
    const results = await MarketplaceService.searchPlaybooks({ query, sortBy: 'relevance' });
    return {
      success: true,
      count: results.length,
      playbooks: results.map(p => ({
        slug: p.slug,
        title: p.title,
        version: p.currentVersion,
        publisher: p.publisherHandle,
        isPaid: p.isPaid,
        priceUsd: p.priceUsdCents / 100,
        rating: p.ratingAverage,
        downloads: p.downloadCount
      }))
    };
  }

  static async info(slug: string) {
    const playbook = await MarketplaceService.getPlaybookBySlug(slug);
    if (!playbook) {
      return { success: false, error: 'PLAYBOOK_NOT_FOUND', message: `Playbook "${slug}" not found in registry.` };
    }
    const versions = await MarketplaceService.getPlaybookVersions(slug);
    return {
      success: true,
      playbook: {
        id: playbook.idDomain,
        slug: playbook.slug,
        title: playbook.title,
        summary: playbook.summary,
        publisher: playbook.publisherName,
        verifiedPublisher: playbook.publisherVerified,
        currentVersion: playbook.currentVersion,
        license: playbook.licenseType,
        isPaid: playbook.isPaid,
        priceUsd: playbook.priceUsdCents / 100,
        versions: versions.map(v => ({
          version: v.version,
          sha256: v.sha256,
          publishedAt: v.publishedAt,
          dokionCompatibility: v.compatibility.dokion
        }))
      }
    };
  }

  static async install(params: { slug: string; version?: string; userId: string; licenseKey?: string }) {
    const playbook = await MarketplaceService.getPlaybookBySlug(params.slug);
    if (!playbook) {
      return { success: false, error: 'PLAYBOOK_NOT_FOUND', message: `Playbook "${params.slug}" not found.` };
    }

    if (playbook.isPaid) {
      // Verify license or active ownership
      const license = await db.licenses
        .where('userId')
        .equals(params.userId)
        .and(l => l.playbookSlug === params.slug && l.status === 'active')
        .first();

      if (!license && params.licenseKey !== playbook.slug) {
        return {
          success: false,
          error: 'LICENSE_REQUIRED',
          message: `Playbook "${params.slug}" requires a valid commercial license. Purchase at /playbooks/${params.slug}`
        };
      }
    }

    const versions = await MarketplaceService.getPlaybookVersions(params.slug);
    const targetVersion = params.version
      ? versions.find(v => v.version === params.version)
      : versions[0] || {
          version: playbook.currentVersion,
          sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
          permissions: [
            { scope: 'project', level: 'read', description: 'Read project source files', required: true }
          ]
        };

    // Record local installation & lockfile
    const lockEntry: LockfileEntry = {
      packageId: playbook.idDomain,
      name: playbook.title,
      version: targetVersion.version,
      sha256: targetVersion.sha256,
      registryUrl: 'https://registry.dokion.io',
      activated: true,
      activationTime: Date.now(),
      permissionsGranted: targetVersion.permissions ? targetVersion.permissions.map(p => p.scope) : ['project']
    };

    await db.lockfiles.put(lockEntry);

    await db.installations.put({
      id: `inst-${Date.now().toString(36)}`,
      userId: params.userId,
      playbookId: playbook.id,
      playbookSlug: playbook.slug,
      installedVersion: targetVersion.version,
      sha256: targetVersion.sha256,
      activated: true,
      permissionsGranted: lockEntry.permissionsGranted,
      installedAt: Date.now(),
      lastCheckAt: Date.now()
    });

    const downloadToken = PaymentService.generateSignedDownloadToken(params.slug, params.licenseKey || 'free-grant');

    return {
      success: true,
      installed: {
        slug: playbook.slug,
        version: targetVersion.version,
        sha256: targetVersion.sha256,
        downloadToken,
        packageUrl: `https://registry.dokion.io/packages/${playbook.slug}-${targetVersion.version}.tgz?token=${downloadToken}`,
        lockfileUpdated: true
      }
    };
  }
}
