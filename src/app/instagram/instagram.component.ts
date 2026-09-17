import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  collection,
  collectionData
} from '@angular/fire/firestore';

import { SocialPost } from '../models';

@Component({
  selector: 'app-instagram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './instagram.component.html',
  styleUrls: ['./instagram.component.css']
})
export class InstagramComponent {

  private readonly firestore = inject(Firestore);

  posts: SocialPost[] = [];

  constructor() {
    collectionData(
      collection(this.firestore, 'social_posts'),
      { idField: 'id' }
    ).subscribe({
      next: (items) => {
        this.posts = items as SocialPost[];
      },
      error: (error) => {
        console.error('Unable to load Instagram statistics:', error);
      }
    });
  }

  get publishedCount(): number {
    return this.posts.filter(
      post => post.status === 'published'
    ).length;
  }

  get scheduledCount(): number {
    return this.posts.filter(
      post => post.status === 'scheduled'
    ).length;
  }

  get failedCount(): number {
    return this.posts.filter(
      post => post.status === 'failed'
    ).length;
  }
}