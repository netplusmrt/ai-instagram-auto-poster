export type PostStatus =
  | 'draft'
  | 'generating'
  | 'ready'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed';

export interface SocialPost {
  id?: string;
  platform: 'instagram';
  topic: string;
  title: string;
  caption: string;
  hashtags: string[];
  imageUrl: string;
  imagePrompt: string;
  status: PostStatus;
  scheduledAt: Date | null;
  publishedAt: string | null;
  instagramMediaId?: string | null;
  retryCount?: number;
  error?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}