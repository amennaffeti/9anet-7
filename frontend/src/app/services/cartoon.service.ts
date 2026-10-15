
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, timeout } from 'rxjs';

export interface CartoonVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  durationMinutes?: string;
  episodeNumber?: number;
  streamUrl?: string;
  pageUrl?: string;
  poster?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CartoonService {
  private http = inject(HttpClient);

  // Fetched once, then replayed from memory: switching to the Cartoons
  // tab never shows "Loading cartoons..." twice in one session.
  private cache$: Observable<CartoonVideo[]> | null = null;
  private sallyCache$: Observable<CartoonVideo[]> | null = null;

  getVideos(): Observable<CartoonVideo[]> {
    if (!this.cache$) {
      this.cache$ = this.http
        .get<CartoonVideo[]>(
          'http://localhost:8080/api/cartoons/spongebob'
        )
        .pipe(
          timeout(20000),
          catchError(error => {
            // Don't cache failures: a retry must hit the backend again.
            this.cache$ = null;
            throw error;
          }),
          shareReplay(1)
        );
    }
    return this.cache$;
  }

  getSallyVideos(): Observable<CartoonVideo[]> {
    if (!this.sallyCache$) {
      this.sallyCache$ = this.http
        .get<CartoonVideo[]>('http://localhost:8080/api/cartoons/sally/toons')
        .pipe(
          // Cold scrape visits ~46 episode pages: allow two minutes,
          // then surface the error instead of spinning forever.
          timeout(120000),
          catchError(error => {
            // Don't cache failures: a retry must hit the backend again.
            this.sallyCache$ = null;
            throw error;
          }),
          shareReplay(1)
        );
    }
    return this.sallyCache$;
  }

  refreshSally(): void {
    this.sallyCache$ = null;
  }
}
