
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChannelService, Channel as ApiChannel } from './services/channel.service';

interface Channel {
  id: number;
  name: string;
  category: 'Tunisian TV' | 'Cartoons';
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
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private channelService = inject(ChannelService);

  searchQuery = '';
  activeCategory = 'All';
  selectedChannel: Channel | null = null;
  loading = true;
  errorMessage = '';

  categories = ['All', 'Tunisian TV', 'Cartoons'];

  channels: Channel[] = [];

  private channelVisuals: Record<string, { icon: string; color: string; status: string }> = {
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
    this.channelService.getChannels().subscribe({
      next: (apiChannels: ApiChannel[]) => {
        this.channels = apiChannels
          .filter(channel => channel.active)
          .map(channel => {
            const visual = this.channelVisuals[channel.name] ?? {
              icon: '📺',
              color: '#345c91',
              status: 'TV'
            };

            return {
              ...channel,
              category: channel.category as Channel['category'],
              description: channel.description ?? '',
              icon: visual.icon,
              color: visual.color,
              status: visual.status
            };
          });

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

      const query = this.searchQuery.toLowerCase();

      const matchesSearch =
        channel.name.toLowerCase().includes(query) ||
        channel.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }

  get featuredChannel(): Channel | undefined {
    return this.selectedChannel ?? this.channels[0];
  }

  selectCategory(category: string): void {
    this.activeCategory = category;
  }

  playChannel(channel: Channel): void {
    this.selectedChannel = channel;
  }
}
