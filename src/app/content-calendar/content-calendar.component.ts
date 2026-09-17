import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  collection,
  collectionData,
  orderBy,
  query,
  doc,
  updateDoc
} from '@angular/fire/firestore';

import { SocialPost } from '../models';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-content-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './content-calendar.component.html',
  styleUrls: ['./content-calendar.component.css']
})
export class ContentCalendarComponent {

  private readonly firestore = inject(Firestore);
  private readonly api = inject(ApiService);

  posts: SocialPost[] = [];
  loading = false;
  message = '';

  constructor() {
    const q = query(
      collection(this.firestore, 'social_posts'),
      orderBy('scheduledAt', 'asc')
    );

    collectionData(q, { idField: 'id' }).subscribe({
      next: (items) => {
        this.posts = (items as SocialPost[])
          .filter(post => post.status === 'scheduled');
      },
      error: (error) => {
        console.error(error);
        this.message = 'Unable to load scheduled posts.';
      }
    });
  }

  getScheduledDate(post: SocialPost): Date | null {
    if (!post.scheduledAt) {
      return null;
    }

    const value: any = post.scheduledAt;

    if (value?.toDate) {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    const date = new Date(value);

    return isNaN(date.getTime()) ? null : date;
  }

  async cancelSchedule(post: SocialPost) {
  if (!post.id) return;

  const confirmed = window.confirm(
    'Are you sure you want to cancel this scheduled post?'
  );

  if (!confirmed) return;

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

    this.message = 'Schedule cancelled successfully.';
  } catch (error: any) {
    console.error(error);
    this.message = error?.message ?? 'Unable to cancel schedule.';
  } finally {
    this.loading = false;
  }
}
}