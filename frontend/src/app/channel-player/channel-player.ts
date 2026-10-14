import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';

import Hls from 'hls.js';

@Component({
  selector: 'app-channel-player',
  standalone: true,
  imports: [],
  templateUrl: './channel-player.html',
  styleUrl: './channel-player.scss'
})
export class ChannelPlayer
  implements OnChanges, AfterViewInit, OnDestroy {

  @Input() streamUrl: string | null = null;
  @Input() channelName = 'Channel';

  @ViewChild('videoElement')
  videoElement?: ElementRef<HTMLVideoElement>;

  isMuted = true;
  message = 'No stream URL configured.';
  private hls: Hls | null = null;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.loadStream();
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
      return;
    }

    this.message = 'Connecting to stream...';

    if (Hls.isSupported()) {
      this.hls = new Hls();

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.message = 'Stream ready.';
        this.startPlayback();
      });

      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          this.message =
            'Playback failed. Check the stream URL or network.';
          console.error('Fatal HLS error:', data);
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
  }

  toggleSound(): void {
    const video = this.videoElement?.nativeElement;

    if (!video) return;

    this.isMuted = !this.isMuted;
    video.muted = this.isMuted;

    if (!this.isMuted) {
      video.play().catch(error => {
        console.error('Playback error:', error);
      });
    }
  }

  private startPlayback(): void {
    const video = this.videoElement?.nativeElement;

    if (!video) return;

    this.isMuted = true;
    video.muted = true;

    video.play().catch(error => {
      this.message = 'Unable to autoplay. Check the stream connection.';
      console.error('Autoplay error:', error);
    });
  }

  ngOnDestroy(): void {
    this.hls?.destroy();
  }
}
