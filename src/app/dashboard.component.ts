import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, collectionData, orderBy, query } from '@angular/fire/firestore';
import { ApiService } from './services/api.service';
import { SocialPost } from './models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  private readonly firestore = inject(Firestore);

  topic = 'GST and accounting tips for Indian small businesses';
  count = 1;
  loading = false;
  message = '';
  posts: SocialPost[] = [];

  get scheduledCount() {
    return this.posts.filter((post) => post.status === 'scheduled').length;
  }

  get publishedCount() {
    return this.posts.filter((post) => post.status === 'published').length;
  }

  get failedCount() {
    return this.posts.filter((post) => post.status === 'failed').length;
  }

  constructor() {
    const q = query(
      collection(this.firestore, 'social_posts'),
      orderBy('createdAt', 'desc')
    );
    collectionData(q, { idField: 'id' }).subscribe((items) => {
      this.posts = items as SocialPost[];
    });
  }

  async generate() {
    this.loading = true;
    this.message = '';
    try {
      const result = await this.api.generateContent({
        topic: this.topic,
        count: this.count
      });
      this.message = `${result.created ?? 1} post(s) generated successfully.`;
    } catch (error: any) {
      this.message = error?.message ?? 'Generation failed.';
    } finally {
      this.loading = false;
    }
  }

  async generateImage(post: SocialPost) {
    if (!post.id) return;
    this.loading = true;
    this.message = '';
    try {
      await this.api.generateImage(post.id);
      this.message = 'AI image generated and stored.';
    } catch (error: any) {
      this.message = error?.message ?? 'Image generation failed.';
    } finally {
      this.loading = false;
    }
  }

  async publish(post: SocialPost) {
    if (!post.id) return;
    this.loading = true;
    this.message = '';
    try {
      await this.api.publish(post.id);
      this.message = 'Post published successfully.';
    } catch (error: any) {
      this.message = error?.message ?? 'Publishing failed.';
    } finally {
      this.loading = false;
    }
  }
}