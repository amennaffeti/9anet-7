
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
import { Reveal } from './reveal';
import Hls from 'hls.js';

interface Channel {
  id: number;
  name: string;
  category: 'Tunisian TV' | 'Cartoons' | 'Radios' | string;
  description: string;
  icon: string;
  color: string;
  status: string;
  logo: string | null;
  logoUrl: string | null;
  streamUrl: string | null;
  active: boolean;
}

interface Suggestion {
  kind: 'channel' | 'show' | 'category';
  kindLabel: string;
  label: string;
  sub: string;
  icon: string;
  category?: string;
  channel?: Channel;
  show?: 'spongebob' | 'sally';
}

const SHOW_SUGGESTIONS: Suggestion[] = [
  {
    kind: 'show',
    kindLabel: 'Cartoon',
    label: 'SpongeBob',
    sub: 'Cartoons • long compilations',
    icon: '🧽',
    show: 'spongebob'
  },
  {
    kind: 'show',
    kindLabel: 'Cartoon',
    label: 'Sally',
    sub: 'Cartoons • 46 episodes',
    icon: '👑',
    show: 'sally'
  }
];

const CATEGORY_ICONS: Record<string, string> = {
  'Tunisian TV': '📺',
  Cartoons: '🎨',
  Radios: '♫'
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, ChannelPlayer, MediaControls, Cartoons, Reveal],
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

  @ViewChild(Cartoons)
  cartoonsComponent?: Cartoons;

  searchQuery = '';
  searchFocused = false;
  suggestionIndex = -1;
  searchPlaceholder = 'Search channels, shows & radios…';
  private placeholderTimer: ReturnType<typeof setInterval> | null = null;
  private readonly placeholderExamples = [
    'Sally',
    'SpongeBob',
    'Wataniya 1',
    'Al Jazeera',
    'Mosaique FM',
    'Cartoons'
  ];
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
    { icon: string; color: string; status: string; logo?: string }
  > = {
    'Wataniya 1': {
      icon: '🇹🇳',
      color: '#b32635',
      status: 'TV',
      logo: 'assets/wataniya1.jpg'
    },
    'Wataniya 2': {
      icon: '📺',
      color: '#345c91',
      status: 'TV',
      logo: 'assets/wataniya2.jpg'
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
    'Al Jazeera': {
      icon: '📰',
      color: '#c47b1a',
      status: 'TV',
      logo: 'assets/aljazeera.jpg'
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
    this.startPlaceholderRotation();
  }

  private startPlaceholderRotation(): void {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    let index = 0;
    this.placeholderTimer = setInterval(() => {
      index = (index + 1) % this.placeholderExamples.length;
      this.searchPlaceholder = `Try "${this.placeholderExamples[index]}"…`;
      this.changeDetector.markForCheck();
    }, 3500);
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
    if (this.placeholderTimer) {
      clearInterval(this.placeholderTimer);
      this.placeholderTimer = null;
    }
    this.stopPreview();
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
              status: visual.status,
              logo: channel.logoUrl ?? visual.logo ?? null
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

  get tvChannels(): Channel[] {
    return this.channels.filter(
      channel => channel.category !== 'Radios'
    );
  }

  switchChannel(name: string): void {
    const channel = this.channels.find(
      candidate => candidate.name === name
    );
    if (channel && channel.name !== this.selectedChannel?.name) {
      this.playChannel(channel);
    }
  }

  previewing: string | null = null;
  private previewHls: Hls | null = null;

  startPreview(channel: Channel, video: HTMLVideoElement): void {
    if (
      !channel.streamUrl ||
      channel.category === 'Radios' ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      return;
    }

    this.stopPreview();
    this.previewing = channel.name;

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 8,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 1
      });
      this.previewHls = hls;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          this.stopPreview();
        }
      });
      hls.loadSource(channel.streamUrl);
      hls.attachMedia(video);
    } else if (
      video.canPlayType('application/vnd.apple.mpegurl')
    ) {
      video.src = channel.streamUrl;
    } else {
      this.previewing = null;
      return;
    }

    video.muted = true;
    video.play().catch(() => {
      this.stopPreview();
    });
  }

  stopPreview(): void {
    this.previewHls?.destroy();
    this.previewHls = null;
    if (this.previewing !== null) {
      this.previewing = null;
    }
  }

  get showSuggestions(): boolean {
    return this.searchFocused && this.searchQuery.trim().length > 0;
  }

  get suggestions(): Suggestion[] {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) return [];

    const starts: Suggestion[] = [];
    const contains: Suggestion[] = [];

    for (const suggestion of this.allSuggestions()) {
      const label = suggestion.label.toLowerCase();
      if (label.startsWith(query)) {
        starts.push(suggestion);
      } else if (label.includes(query)) {
        contains.push(suggestion);
      }
    }

    return [...starts, ...contains].slice(0, 7);
  }

  private allSuggestions(): Suggestion[] {
    const list: Suggestion[] = [...SHOW_SUGGESTIONS];

    for (const category of this.categories) {
      list.push({
        kind: 'category',
        kindLabel: 'Category',
        label: category,
        sub: 'Browse everything here',
        icon: CATEGORY_ICONS[category] ?? '▣'
      });
    }

    for (const channel of this.channels) {
      list.push({
        kind: 'channel',
        kindLabel: channel.category,
        label: channel.name,
        sub: channel.description || channel.category,
        icon: channel.icon,
        category: channel.category,
        channel
      });
    }

    return list;
  }

  highlightMatch(label: string): string {
    const query = this.searchQuery.trim();
    if (!query) return label;
    const index = label.toLowerCase().indexOf(query.toLowerCase());
    if (index < 0) return label;
    return (
      label.slice(0, index) +
      '<b>' +
      label.slice(index, index + query.length) +
      '</b>' +
      label.slice(index + query.length)
    );
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const items = this.suggestions;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (items.length === 0) return;
      this.suggestionIndex =
        event.key === 'ArrowDown'
          ? (this.suggestionIndex + 1) % items.length
          : (this.suggestionIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Enter') {
      if (this.suggestionIndex >= 0 && this.suggestionIndex < items.length) {
        event.preventDefault();
        this.selectSuggestion(items[this.suggestionIndex]);
      }
    } else if (event.key === 'Escape') {
      this.searchQuery = '';
      this.suggestionIndex = -1;
      (event.target as HTMLInputElement | null)?.blur();
    } else {
      this.suggestionIndex = -1;
    }
  }

  onSearchBlur(): void {
    // Let suggestion clicks land before closing the dropdown.
    setTimeout(() => {
      this.searchFocused = false;
      this.suggestionIndex = -1;
      this.changeDetector.markForCheck();
    }, 150);
  }

  clearSearch(event: Event): void {
    event.preventDefault();
    this.searchQuery = '';
    this.suggestionIndex = -1;
  }

  selectSuggestion(suggestion: Suggestion, event?: Event): void {
    event?.preventDefault();
    this.searchFocused = false;
    this.suggestionIndex = -1;

    if (suggestion.kind === 'channel' && suggestion.channel) {
      this.searchQuery = '';
      this.selectCategory(suggestion.category ?? suggestion.channel.category);
      this.playChannel(suggestion.channel);
      return;
    }

    if (suggestion.kind === 'show' && suggestion.show) {
      this.searchQuery = '';
      this.selectCategory('Cartoons');
      this.changeDetector.markForCheck();
      this.scrollToChannels();
      const show = suggestion.show;
      setTimeout(() => {
        this.cartoonsComponent?.openShow(show);
        this.changeDetector.markForCheck();
      });
      return;
    }

    this.searchQuery = '';
    this.selectCategory(suggestion.label);
    this.scrollToChannels();
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
    this.stopPreview();
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
