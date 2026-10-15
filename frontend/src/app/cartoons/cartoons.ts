import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';
import {
  DomSanitizer,
  SafeResourceUrl
} from '@angular/platform-browser';
import {
  CartoonService,
  CartoonVideo
} from '../services/cartoon.service';

type ShowId = 'spongebob' | 'sally';

@Component({
  selector: 'app-cartoons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cartoons.html',
  styleUrl: './cartoons.scss'
})
export class Cartoons implements OnInit {
  private cartoons = inject(CartoonService);
  private changeDetector = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  selectedVideoUrl: SafeResourceUrl | null = null;
  videos: CartoonVideo[] = [];
  loading = true;
  errorMessage = '';
  sallyVideos: CartoonVideo[] = [];
  sallyLoading = false;
  sallyError = '';
  private sallyRequested = false;
  selectedVideo: CartoonVideo | null = null;
  selectedShow: ShowId | null = null;
  layout: 'grid' | 'list' = 'grid';

  ngOnInit(): void {
    try {
      if (localStorage.getItem('cartoon-layout') === 'list') {
        this.layout = 'list';
      }
    } catch {
      // Private mode etc: fall back to grid.
    }
    // Served from the service memory cache after the first load, so
    // reopening the tab is instant. Failures surface the error message
    // instead of leaving "Loading cartoons..." stuck on screen.
    this.cartoons
      .getVideos()
      .subscribe({
        next: videos => {
          this.videos = videos;
          this.loading = false;
          // The app runs without zone.js: async callbacks must notify
          // change detection explicitly, otherwise the view stays stuck
          // on "Loading cartoons..." until an unrelated update happens.
          this.changeDetector.markForCheck();
        },
        error: error => {
          console.error('Failed to load cartoons:', error);
          this.errorMessage =
            'Could not load cartoons. Check that the backend is running.';
          this.loading = false;
          this.changeDetector.markForCheck();
        }
      });
    // Warm the Sally list in the background while the user looks at the
    // covers, so opening Sally feels instant even on a cold backend.
    this.ensureSallyLoaded();
  }

  get currentVideos(): CartoonVideo[] {
    const list =
      this.selectedShow === 'sally' ? this.sallyVideos : this.videos;
    if (this.selectedShow === 'sally') {
      return [...list].sort(
        (a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0)
      );
    }
    return list;
  }

  get currentLoading(): boolean {
    return this.selectedShow === 'sally'
      ? this.sallyLoading
      : this.loading;
  }

  get currentError(): string {
    return this.selectedShow === 'sally'
      ? this.sallyError
      : this.errorMessage;
  }

  get currentTitle(): string {
    return this.selectedShow === 'sally' ? 'Sally' : 'SpongeBob';
  }

  get selectedEpisodeLabel(): string {
    if (!this.selectedVideo) return '';
    const total = this.currentVideos.length;
    const position =
      this.selectedVideo.episodeNumber ?? this.selectedIndex + 1;
    return `Ep ${position} of ${total}`;
  }

  toggleLayout(): void {
    this.layout = this.layout === 'grid' ? 'list' : 'grid';
    try {
      localStorage.setItem('cartoon-layout', this.layout);
    } catch {
      // Private mode etc: layout just won't persist.
    }
    this.changeDetector.markForCheck();
  }

  get selectedIndex(): number {
    if (!this.selectedVideo) return -1;
    const selected = this.selectedVideo;
    return this.currentVideos.findIndex(video => {
      if (selected.episodeNumber != null
        && video.episodeNumber != null) {
        return video.episodeNumber === selected.episodeNumber;
      }
      if (selected.videoId && video.videoId) {
        return video.videoId === selected.videoId;
      }
      return !!selected.streamUrl
        && video.streamUrl === selected.streamUrl;
    });
  }

  get hasPrevious(): boolean {
    return this.selectedIndex > 0;
  }

  get hasNext(): boolean {
    return (
      this.selectedIndex >= 0 &&
      this.selectedIndex < this.currentVideos.length - 1
    );
  }

  playPrevious(): void {
    if (!this.hasPrevious) return;
    this.playVideo(this.currentVideos[this.selectedIndex - 1]);
  }

  playNext(): void {
    if (!this.hasNext) return;
    this.playVideo(this.currentVideos[this.selectedIndex + 1]);
  }

  private embedUrlFor(video: CartoonVideo): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://www.youtube-nocookie.com/embed/' +
        video.videoId +
        '?autoplay=1&rel=0'
    );
  }

  openShow(show: ShowId): void {
    this.selectedShow = show;
    if (show === 'sally') {
      this.ensureSallyLoaded();
    }
    this.changeDetector.markForCheck();
  }

  retrySally(): void {
    this.sallyRequested = false;
    this.cartoons.refreshSally();
    this.ensureSallyLoaded();
  }

  private ensureSallyLoaded(): void {
    if (this.sallyRequested) return;
    this.sallyRequested = true;
    this.sallyLoading = true;
    this.sallyError = '';
    this.cartoons.getSallyVideos().subscribe({
      next: videos => {
        this.sallyVideos = videos;
        this.sallyLoading = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        console.error('Failed to load Sally episodes:', error);
        this.sallyError =
          'Could not load Sally episodes. Check that the backend is running.';
        this.sallyLoading = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  closeShow(): void {
    this.selectedShow = null;
    this.changeDetector.markForCheck();
  }

  playVideo(video: CartoonVideo): void {
    if (!video.videoId && !video.streamUrl) return;
    this.selectedVideo = video;
    this.selectedVideoUrl = this.embedUrlFor(video);
    this.changeDetector.markForCheck();
  }

  closeVideo(): void {
    this.selectedVideo = null;
    this.selectedVideoUrl = null;
  }
}
