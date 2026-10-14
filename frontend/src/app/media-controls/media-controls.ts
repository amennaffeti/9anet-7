import {
  Component,
  Input,
  OnDestroy,
  SimpleChanges,
  OnChanges
} from '@angular/core';

@Component({
  selector: 'app-media-controls',
  standalone: true,
  templateUrl: './media-controls.html',
  styleUrl: './media-controls.scss'
})
export class MediaControls implements OnChanges, OnDestroy {
  @Input() media: HTMLMediaElement | null = null;

  volume = 1;
  isMuted = true;

  private readonly syncMediaState = (): void => {
    this.syncFromMedia();
  };

  get volumePercent(): number {
    return Math.round(this.volume * 100);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['media']) {
      const previousMedia = changes['media'].previousValue as
        | HTMLMediaElement
        | null;
      previousMedia?.removeEventListener('volumechange', this.syncMediaState);
      this.media?.addEventListener('volumechange', this.syncMediaState);
      this.syncFromMedia();
    }
  }

  toggleMuted(): void {
    if (!this.media) return;

    if (this.media.muted) {
      if (this.media.volume === 0) {
        this.media.volume = 0.15;
      }
      this.media.muted = false;
      this.media.play().catch(error => {
        console.error('Playback error:', error);
      });
    } else {
      this.media.muted = true;
    }

    this.syncFromMedia();
  }

  changeVolume(delta: number): void {
    if (!this.media) return;
    this.setVolume(this.media.volume + delta);
  }

  onVolumeInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    this.setVolume(Number(input.value));
  }

  ngOnDestroy(): void {
    this.media?.removeEventListener('volumechange', this.syncMediaState);
  }

  private setVolume(value: number): void {
    if (!this.media) return;

    this.media.volume = Math.max(0, Math.min(1, value));
    this.media.muted = this.media.volume === 0;
    this.syncFromMedia();
  }

  private syncFromMedia(): void {
    if (!this.media) return;
    this.volume = this.media.volume;
    this.isMuted = this.media.muted;
  }
}
