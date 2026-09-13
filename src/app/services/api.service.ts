import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  async generateContent(body: { topic: string; count: number }) {
    return firstValueFrom(this.http.post<{ created: number }>('/api/generate-content', body));
  }

  async generateImage(postId: string) {
    return firstValueFrom(this.http.post<{ imageUrl: string }>('/api/generate-image', { postId }));
  }

  async publish(postId: string) {
    return firstValueFrom(this.http.post<{ ok: boolean }>('/api/publish-instagram', { postId }));
  }
}