import { db } from '../db';
import type { PlaybookListing, PlaybookVersion, ReviewRecord } from '../types/marketplace';
import { seedMarketplaceDatabase } from './seedMarketplaceData';

export interface SearchFilters {
  query?: string;
  category?: string;
  isPaid?: boolean;
  isOfficial?: boolean;
  verifiedOnly?: boolean;
  minRating?: number;
  sortBy?: 'relevance' | 'recently_updated' | 'highest_rated' | 'most_installed' | 'price_low' | 'price_high';
}

export class MarketplaceService {
  static async init() {
    await seedMarketplaceDatabase();
  }

  static async searchPlaybooks(filters: SearchFilters): Promise<PlaybookListing[]> {
    await this.init();
    let listings = await db.playbookListings.where('status').equals('PUBLISHED').toArray();

    if (filters.category && filters.category !== 'All') {
      listings = listings.filter(l => l.category === filters.category);
    }

    if (filters.isPaid !== undefined) {
      listings = listings.filter(l => l.isPaid === filters.isPaid);
    }

    if (filters.isOfficial) {
      listings = listings.filter(l => l.isOfficial);
    }

    if (filters.verifiedOnly) {
      listings = listings.filter(l => l.publisherVerified);
    }

    if (filters.minRating) {
      listings = listings.filter(l => l.ratingAverage >= filters.minRating!);
    }

    if (filters.query && filters.query.trim()) {
      const q = filters.query.toLowerCase().trim();
      listings = listings.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.publisherName.toLowerCase().includes(q) ||
        l.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Sort
    switch (filters.sortBy) {
      case 'recently_updated':
        listings.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'highest_rated':
        listings.sort((a, b) => b.ratingAverage - a.ratingAverage);
        break;
      case 'most_installed':
        listings.sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      case 'price_low':
        listings.sort((a, b) => a.priceUsdCents - b.priceUsdCents);
        break;
      case 'price_high':
        listings.sort((a, b) => b.priceUsdCents - a.priceUsdCents);
        break;
      case 'relevance':
      default:
        listings.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.downloadCount - a.downloadCount);
        break;
    }

    return listings;
  }

  static async getPlaybookBySlug(slug: string): Promise<PlaybookListing | undefined> {
    await this.init();
    return db.playbookListings.where('slug').equals(slug).first();
  }

  static async getPlaybookVersions(slug: string): Promise<PlaybookVersion[]> {
    await this.init();
    return db.playbookVersions.where('playbookSlug').equals(slug).toArray();
  }

  static async getPlaybookReviews(slug: string): Promise<ReviewRecord[]> {
    await this.init();
    return db.reviews.where('playbookSlug').equals(slug).toArray();
  }

  static async submitReview(input: {
    playbookSlug: string;
    userId: string;
    userName: string;
    userAvatarUrl: string;
    rating: number;
    title: string;
    content: string;
  }): Promise<ReviewRecord> {
    const playbook = await this.getPlaybookBySlug(input.playbookSlug);
    if (!playbook) throw new Error('Playbook not found');

    // Check ownership / installation
    const license = await db.licenses
      .where('userId')
      .equals(input.userId)
      .and(l => l.playbookSlug === input.playbookSlug && l.status === 'active')
      .first();

    const installation = await db.installations
      .where('userId')
      .equals(input.userId)
      .and(i => i.playbookSlug === input.playbookSlug)
      .first();

    const isVerifiedOwner = Boolean(license || installation || !playbook.isPaid);

    // Check existing review
    const existing = await db.reviews
      .where('playbookSlug')
      .equals(input.playbookSlug)
      .and(r => r.userId === input.userId)
      .first();

    const reviewId = existing ? existing.id : `rev-${Date.now().toString(36)}`;
    const review: ReviewRecord = {
      id: reviewId,
      playbookId: playbook.id,
      playbookSlug: input.playbookSlug,
      userId: input.userId,
      userName: input.userName,
      userAvatarUrl: input.userAvatarUrl,
      verifiedOwner: isVerifiedOwner,
      rating: input.rating,
      title: input.title,
      content: input.content,
      helpfulVotes: existing ? existing.helpfulVotes : 0,
      revisions: existing ? [...(existing.revisions || []), { content: existing.content, rating: existing.rating, updatedAt: existing.updatedAt }] : [],
      moderated: false,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now()
    };

    await db.reviews.put(review);

    // Recalculate average rating
    const allReviews = await this.getPlaybookReviews(input.playbookSlug);
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = Number((totalRating / allReviews.length).toFixed(1));

    await db.playbookListings.update(playbook.id, {
      ratingAverage: avgRating,
      ratingCount: allReviews.length,
      updatedAt: Date.now()
    });

    return review;
  }
}
