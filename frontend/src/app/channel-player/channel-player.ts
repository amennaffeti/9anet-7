import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';

import Hls from 'hls.js';
import { MediaControls } from '../media-controls/media-controls';

@Component({
  selector: 'app-channel-player',
  standalone: true,
  imports: [MediaControls],
  templateUrl: './channel-player.html',
  styleUrl: './channel-player.scss'
})
export class ChannelPlayer
  implements OnChanges, AfterViewInit, OnDestroy {

  private changeDetector = inject(ChangeDetectorRef);

  @Input() streamUrl: string | null = null;
  @Input() channelName = 'Channel';

  @ViewChild('videoElement')
  videoElement?: ElementRef<HTMLVideoElement>;

  message = 'No stream URL configured.';
  private hls: Hls | null = null;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    setTimeout(() => {
      this.loadStream();
      this.changeDetector.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['streamUrl'] && this.viewReady) {
      this.loadStream();
    }
  }

  private loadStream(): void {
    const video = this.videoElement?.nativeElement;

    if (!video) return;

    this.hls?.destroy();
    this.hls = null;

    video.pause();
    video.removeAttribute('src');
    video.load();

    if (!this.streamUrl) {
      this.message = 'No stream URL configured.';
      this.changeDetector.markForCheck();
      return;
    }

    this.message = 'Connecting to stream...';

    if (Hls.isSupported()) {
      this.hls = new Hls();

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.message = 'Stream ready.';
        this.startPlayback();
        this.changeDetector.markForCheck();
      });

      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          this.message =
            'Playback failed. Check the stream URL or network.';
          console.error('Fatal HLS error:', data);
          this.changeDetector.markForCheck();
        }
      });

      this.hls.loadSource(this.streamUrl);
      this.hls.attachMedia(video);

    } else if (
      video.canPlayType('application/vnd.apple.mpegurl')
    ) {
      video.src = this.streamUrl;
      this.message = 'Stream loaded.';
      this.startPlayback();
    } else {
      this.message = 'HLS playback is not supported here.';
    }

    this.changeDetector.markForCheck();
  }

  private startPlayback(): void {
    const video = this.videoElement?.nativeElement;

    if (!video) return;

    video.muted = true;

    video.play().catch(error => {
      this.message = 'Unable to autoplay. Check the stream connection.';
      console.error('Autoplay error:', error);
      this.changeDetector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.hls?.destroy();
  }
}
