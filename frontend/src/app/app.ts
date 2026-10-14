
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  ChannelService,
  Channel as ApiChannel
} from './services/channel.service';
import { ChannelPlayer } from './channel-player/channel-player';

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
  imports: [FormsModule, ChannelPlayer],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private channelService = inject(ChannelService);
  private http = inject(HttpClient);

  searchQuery = '';
  activeCategory = 'All';
  selectedChannel: Channel | null = null;
  loading = true;
  errorMessage = '';
  importingRadios = false;
  importMessage = '';

  categories = ['All', 'Tunisian TV', 'Cartoons', 'Radios'];

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
      },
      error: () => {
        this.errorMessage =
          'Unable to load channels. Please make sure the backend is running.';
        this.loading = false;
      }
    });
  }

  get filteredChannels(): Channel[] {
    return this.channels.filter(channel => {
      const matchesCategory =
        this.activeCategory === 'All' ||
        channel.category === this.activeCategory;

      const query = this.searchQuery.toLowerCase().trim();

      const matchesSearch =
        channel.name.toLowerCase().includes(query) ||
        channel.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }

  get featuredChannel(): Channel | undefined {
    return this.selectedChannel ?? this.channels[0];
  }

  get isRadioSelected(): boolean {
    return this.featuredChannel?.category === 'Radios';
  }

  selectCategory(category: string): void {
    this.activeCategory = category;
  }

  playChannel(channel: Channel): void {
    this.selectedChannel = channel;
  }

  onRadioCanPlay(): void {
    // The browser has enough data to begin playback.
  }

  onRadioError(): void {
    console.warn('The selected radio stream could not be played.');
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
        },
        error: error => {
          console.error('Radio import failed:', error);
          this.importMessage =
            'Could not refresh radios. Check that the backend is running.';
          this.importingRadios = false;
        }
      });
  }
}
