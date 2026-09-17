import { Component, inject, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  Firestore,
  collection,
  collectionData,
  orderBy,
  query,
  doc,
  updateDoc,
  Timestamp
} from '@angular/fire/firestore';

import { ApiService } from '../services/api.service';
import { SocialPost } from '../models';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  private readonly firestore = inject(Firestore);
  private readonly environmentInjector = inject(EnvironmentInjector);

  topic = 'GST and accounting tips for Indian small businesses';
  count = 1;

  loading = false;
  message = '';

  posts: SocialPost[] = [];

  mobileMenuOpen = false;

  

  constructor() {
    const q = query(
      collection(this.firestore, 'social_posts'),
      orderBy('createdAt', 'desc')
    );

    collectionData(q, { idField: 'id' }).subscribe((items) => {
      this.posts = items as SocialPost[];
    });
  }

  get scheduledCount() {
    return this.posts.filter(
      (post) => post.status === 'scheduled'
    ).length;
  }

  get publishedCount() {
    return this.posts.filter(
      (post) => post.status === 'published'
    ).length;
  }

  get failedCount() {
    return this.posts.filter(
      (post) => post.status === 'failed'
    ).length;
  }

  async generate() {
    this.loading = true;
    this.message = '';

    try {
      const result = await this.api.generateContent({
        topic: this.topic,
        count: this.count
      });

      this.message =
        `${result.created ?? 1} post(s) generated successfully.`;
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
      this.message =
        error?.message ?? 'Image generation failed.';
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
      this.message =
        error?.message ?? 'Publishing failed.';
    } finally {
      this.loading = false;
    }
  }

  async schedulePost(post: SocialPost) {
  if (!post.id) return;

  if (!post.scheduledAt) {
    this.message = 'Please select a date and time.';
    return;
  }

  if (!post.imageUrl) {
    this.message = 'Generate the image before scheduling.';
    return;
  }

  const scheduledDate = new Date(post.scheduledAt);

  if (isNaN(scheduledDate.getTime())) {
    this.message = 'Invalid schedule date and time.';
    return;
  }

  if (scheduledDate.getTime() <= Date.now()) {
    this.message = 'Please select a future date and time.';
    return;
  }

  this.loading = true;
  this.message = '';

  try {
    const postRef = doc(
      this.firestore,
      'social_posts',
      post.id
    );

    await runInInjectionContext(
      this.environmentInjector,
      () =>
        updateDoc(postRef, {
          status: 'scheduled',
          scheduledAt: Timestamp.fromDate(scheduledDate),
          updatedAt: Timestamp.now()
        })
    );

    // Keep the UI value compatible with datetime-local
    post.status = 'scheduled';

    this.message = 'Post scheduled successfully.';

  } catch (error: any) {
    console.error('Schedule post error:', error);

    this.message =
      error?.message ?? 'Scheduling failed.';

  } finally {
    this.loading = false;
  }
}

  async cancelSchedule(post: SocialPost) {
    if (!post.id) return;

    this.loading = true;
    this.message = '';

    try {
      const postRef = doc(
        this.firestore,
        'social_posts',
        post.id
      );

      await updateDoc(postRef, {
        status: 'ready',
        scheduledAt: null,
        updatedAt: new Date()
      });

      this.message = 'Schedule cancelled.';
    } catch (error: any) {
      console.error(error);

      this.message =
        error?.message ?? 'Unable to cancel schedule.';
    } finally {
      this.loading = false;
    }
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }
}