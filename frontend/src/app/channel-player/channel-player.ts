import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';

import Hls from 'hls.js';
import { MediaControls } from '../media-controls/media-controls';

export interface RailChannel {
  name: string;
  icon: string;
  color: string;
  status: string;
}

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
  @Input() channels: RailChannel[] = [];
  @Output() channelPick = new EventEmitter<string>();

  @ViewChild('videoElement')
  videoElement?: ElementRef<HTMLVideoElement>;

  message = 'No stream URL configured.';
  private hls: Hls | null = null;
  private viewReady = false;
  private railCloseTimer: ReturnType<typeof setTimeout> | null = null;

  railOpen = false;

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
    if (this.railCloseTimer) {
      clearTimeout(this.railCloseTimer);
      this.railCloseTimer = null;
    }
  }

  openRail(): void {
    if (this.railCloseTimer) {
      clearTimeout(this.railCloseTimer);
      this.railCloseTimer = null;
    }
    if (!this.railOpen) {
      this.railOpen = true;
      this.changeDetector.markForCheck();
    }
  }

  scheduleRailClose(): void {
    if (this.railCloseTimer) {
      clearTimeout(this.railCloseTimer);
    }
    this.railCloseTimer = setTimeout(() => {
      this.railOpen = false;
      this.railCloseTimer = null;
      this.changeDetector.markForCheck();
    }, 220);
  }

  toggleRail(): void {
    if (this.railCloseTimer) {
      clearTimeout(this.railCloseTimer);
      this.railCloseTimer = null;
    }
    this.railOpen = !this.railOpen;
    this.changeDetector.markForCheck();
  }

  pickChannel(name: string): void {
    this.railOpen = false;
    this.changeDetector.markForCheck();
    this.channelPick.emit(name);
  }
}
