
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
  inject
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  ChannelService,
  Channel as ApiChannel
} from './services/channel.service';
import { ChannelPlayer } from './channel-player/channel-player';
import { MediaControls } from './media-controls/media-controls';
import { Cartoons } from './cartoons/cartoons';

interface Channel {
  id: number;
  name: string;
  category: 'Tunisian TV' | 'Cartoons' | 'Radios' | string;
  description: string;
  icon: string;
  color: string;
  status: string;
  logoUrl: string | null;
  streamUrl: string | null;
  active: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, ChannelPlayer, MediaControls, Cartoons],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  private channelService = inject(ChannelService);
  private http = inject(HttpClient);
  private changeDetector = inject(ChangeDetectorRef);
  private document = inject(DOCUMENT);
  private previousBodyOverflow: string | null = null;
  private introTimer: ReturnType<typeof setTimeout> | null = null;
  private introCutTimer: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('introVideo')
  introVideo?: ElementRef<HTMLVideoElement>;

  @ViewChild('radioElement')
  radioElement?: ElementRef<HTMLAudioElement>;

  introState:
    | 'playing'
    | 'holding'
    | 'fading-to-black'
    | 'revealing'
    | 'done' = 'playing';

  searchQuery = '';
  activeCategory = 'Tunisian TV';
  selectedChannel: Channel | null = null;
  radioLoading = false;
  radioFailed = false;
  loading = true;
  errorMessage = '';
  importingRadios = false;
  importMessage = '';
  private initialRadioImportAttempted = false;

  categories = ['Tunisian TV', 'Cartoons', 'Radios'];

  channels: Channel[] = [];

  private channelVisuals: Record<
    string,
    { icon: string; color: string; status: string }
  > = {
    'Wataniya 1': {
      icon: '🇹🇳',
      color: '#b32635',
      status: 'TV'
    },
    'Wataniya 2': {
      icon: '📺',
      color: '#345c91',
      status: 'TV'
    },
    'Hannibal TV': {
      icon: '🎬',
      color: '#9b6a37',
      status: 'TV'
    },
    'Nessma': {
      icon: '📡',
      color: '#247f83',
      status: 'TV'
    },
    'Kids Zone': {
      icon: '🚀',
      color: '#6c4ccf',
      status: 'KIDS'
    },
    'Cartoon World': {
      icon: '🦊',
      color: '#d66b32',
      status: 'KIDS'
    },
    'Mini Adventures': {
      icon: '🪐',
      color: '#287d69',
      status: 'KIDS'
    },
    'Toon Planet': {
      icon: '🌈',
      color: '#b14e83',
      status: 'KIDS'
    }
  };

  ngOnInit(): void {
    this.loadChannels();
  }

  ngAfterViewInit(): void {
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';

    this.startHeroVideos();

    const video = this.introVideo?.nativeElement;
    if (!video) {
      this.onIntroVideoError();
      return;
    }

    video.muted = true;
    video.playbackRate = 1;
    video.play().catch(error => {
      console.error('Intro video playback failed:', error);
      this.onIntroVideoError();
    });

    // The file is ~8s: show ~4s at normal speed, then run the fade-out
    // sequence. Also acts as a fallback if `ended` never fires.
    this.clearIntroCutTimer();
    this.introCutTimer = setTimeout(() => {
      this.finishIntroEarly();
    }, 4000);
  }

  private startHeroVideos(): void {
    // The `muted` HTML attribute alone does not set the media `muted`
    // property on dynamically created elements, so unmuted autoplay gets
    // blocked and the clips look like static photos. Set it imperatively.
    this.document.querySelectorAll('.hero-media video').forEach(element => {
      const clip = element as HTMLVideoElement;
      clip.muted = true;
      clip.play().catch(() => {
        // Autoplay blocked: the clip stays on its first frame.
      });
    });
  }

  ngOnDestroy(): void {
    if (this.introTimer) {
      clearTimeout(this.introTimer);
    }
    this.clearIntroCutTimer();
    this.document.body.style.overflow = this.previousBodyOverflow ?? '';
  }

  onIntroEnded(): void {
    if (this.introState !== 'playing') return;

    this.clearIntroCutTimer();
    this.beginIntroOutro();
  }

  private finishIntroEarly(): void {
    if (this.introState !== 'playing') return;

    // Freeze at ~4s so the last visible frame holds briefly.
    this.introVideo?.nativeElement.pause();
    this.beginIntroOutro();
  }

  private beginIntroOutro(): void {
    this.introState = 'holding';
    this.introTimer = setTimeout(() => {
      this.introState = 'fading-to-black';
      this.changeDetector.markForCheck();

      this.introTimer = setTimeout(() => {
        this.introState = 'revealing';
        this.changeDetector.markForCheck();

        this.introTimer = setTimeout(() => {
          this.introState = 'done';
          this.document.body.style.overflow =
            this.previousBodyOverflow ?? '';
          this.previousBodyOverflow = null;
          this.changeDetector.markForCheck();
        }, 800);
      }, 600);
    }, 450);
  }

  private clearIntroCutTimer(): void {
    if (this.introCutTimer) {
      clearTimeout(this.introCutTimer);
      this.introCutTimer = null;
    }
  }

  onIntroVideoError(): void {
    if (this.introState !== 'playing') return;

    if (this.introTimer) {
      clearTimeout(this.introTimer);
    }
    this.clearIntroCutTimer();

    console.error('Intro video could not be loaded.');
    this.introState = 'revealing';
    this.changeDetector.markForCheck();

    this.introTimer = setTimeout(() => {
      this.introState = 'done';
      this.document.body.style.overflow = this.previousBodyOverflow ?? '';
      this.previousBodyOverflow = null;
      this.changeDetector.markForCheck();
    }, 800);
  }

  private loadChannels(): void {
    this.loading = true;
    this.errorMessage = '';

    this.channelService.getChannels().subscribe({
      next: (apiChannels: ApiChannel[]) => {
        this.channels = apiChannels
          .filter(channel => channel.active)
          .map(channel => {
            const isRadio = channel.category === 'Radios';

            const visual = this.channelVisuals[channel.name] ?? {
              icon: isRadio ? '📻' : '📺',
              color: isRadio ? '#287d69' : '#345c91',
              status: isRadio ? 'RADIO' : 'TV'
            };

            return {
              ...channel,
              category: channel.category,
              description: channel.description ?? '',
              icon: visual.icon,
              color: visual.color,
              status: visual.status
            };
          });

        // Keep the selected channel updated after reloading.
        if (this.selectedChannel) {
          this.selectedChannel =
            this.channels.find(
              channel => channel.id === this.selectedChannel?.id
            ) ?? null;
        }

        this.loading = false;

        if (
          !this.initialRadioImportAttempted &&
          !this.channels.some(channel => channel.category === 'Radios')
        ) {
          this.initialRadioImportAttempted = true;
          this.refreshRadios();
        }

        this.changeDetector.markForCheck();
      },
      error: () => {
        this.errorMessage =
          'Unable to load channels. Please make sure the backend is running.';
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  get filteredChannels(): Channel[] {
    return this.channels.filter(channel => {
      const matchesCategory = channel.category === this.activeCategory;

      const query = this.searchQuery.toLowerCase().trim();

      const matchesSearch =
        channel.name.toLowerCase().includes(query) ||
        channel.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }

  selectCategory(category: string): void {
    this.activeCategory = category;
  }

  scrollToChannels(): void {
    this.document
      .getElementById('channels')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  playChannel(channel: Channel): void {
    this.selectedChannel = channel;
    this.radioLoading = channel.category === 'Radios' && !!channel.streamUrl;
    this.radioFailed = false;
    this.previousBodyOverflow = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';

    const fullscreenElement = this.document.documentElement;
    if (!this.document.fullscreenElement && fullscreenElement.requestFullscreen) {
      void fullscreenElement.requestFullscreen().catch(error => {
        console.warn('Fullscreen mode is unavailable:', error);
      });
    }
  }

  closePlayer(): void {
    this.selectedChannel = null;
    this.radioLoading = false;
    this.radioFailed = false;
    this.document.body.style.overflow = this.previousBodyOverflow ?? '';
    this.previousBodyOverflow = null;

    if (this.document.fullscreenElement && this.document.exitFullscreen) {
      void this.document.exitFullscreen().catch(error => {
        console.warn('Could not exit fullscreen mode:', error);
      });
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closePlayer();
  }

  onRadioCanPlay(): void {
    // The browser has enough data to begin playback.
  }

  onRadioPlaying(): void {
    // The stream is actually audible: dismiss the loading overlay.
    this.radioLoading = false;
    this.radioFailed = false;
  }

  onRadioWaiting(): void {
    // Buffering mid-stream: show the loading overlay again.
    if (this.selectedChannel?.streamUrl) {
      this.radioFailed = false;
      this.radioLoading = true;
    }
  }

  onRadioError(): void {
    this.radioLoading = false;
    this.radioFailed = true;
  }

  retryRadio(): void {
    if (!this.selectedChannel?.streamUrl) return;

    this.radioFailed = false;
    this.radioLoading = true;
    this.radioElement?.nativeElement.load();
  }

  refreshRadios(): void {
    if (this.importingRadios) {
      return;
    }

    this.importingRadios = true;
    this.importMessage = '';

    this.http
      .post<{
        source: string;
        stationsFound: number;
        imported: number;
        skipped: number;
      }>('http://localhost:8080/api/channels/import-radios', {})
      .subscribe({
        next: result => {
          this.importMessage =
            `Found ${result.stationsFound} stations; ` +
            `added ${result.imported} new radios; ` +
            `skipped ${result.skipped}.`;

          this.loadChannels();
          this.importingRadios = false;
          this.changeDetector.markForCheck();
        },
        error: error => {
          console.error('Radio import failed:', error);
          this.importMessage =
            'Could not refresh radios. Check that the backend is running.';
          this.importingRadios = false;
          this.changeDetector.markForCheck();
        }
      });
  }
}
