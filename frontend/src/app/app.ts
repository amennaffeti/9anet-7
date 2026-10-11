
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Channel {
  name: string;
  category: 'Tunisian TV' | 'Cartoons';
  description: string;
  icon: string;
  color: string;
  status: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  searchQuery = '';
  activeCategory = 'All';
  selectedChannel: Channel | null = null;

  categories = ['All', 'Tunisian TV', 'Cartoons'];

  channels: Channel[] = [
    {
      name: 'Wataniya 1',
      category: 'Tunisian TV',
      description: 'National television',
      icon: '🇹🇳',
      color: '#b32635',
      status: 'LIVE'
    },
    {
      name: 'Wataniya 2',
      category: 'Tunisian TV',
      description: 'Culture & entertainment',
      icon: '📺',
      color: '#345c91',
      status: 'LIVE'
    },
    {
      name: 'Hannibal TV',
      category: 'Tunisian TV',
      description: 'Entertainment',
      icon: '🎬',
      color: '#9b6a37',
      status: 'TV'
    },
    {
      name: 'Nessma',
      category: 'Tunisian TV',
      description: 'News & entertainment',
      icon: '📡',
      color: '#247f83',
      status: 'TV'
    },
    {
      name: 'Kids Zone',
      category: 'Cartoons',
      description: 'Animated adventures',
      icon: '🚀',
      color: '#6c4ccf',
      status: 'KIDS'
    },
    {
      name: 'Cartoon World',
      category: 'Cartoons',
      description: 'Cartoons for everyone',
      icon: '🦊',
      color: '#d66b32',
      status: 'KIDS'
    },
    {
      name: 'Mini Adventures',
      category: 'Cartoons',
      description: 'Little heroes, big stories',
      icon: '🪐',
      color: '#287d69',
      status: 'KIDS'
    },
    {
      name: 'Toon Planet',
      category: 'Cartoons',
      description: 'A world of animation',
      icon: '🌈',
      color: '#b14e83',
      status: 'KIDS'
    }
  ];

  get filteredChannels(): Channel[] {
    return this.channels.filter(channel => {
      const matchesCategory =
        this.activeCategory === 'All' ||
        channel.category === this.activeCategory;

      const matchesSearch =
        channel.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        channel.description.toLowerCase().includes(this.searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }

  get featuredChannel(): Channel {
    return this.selectedChannel ?? this.channels[0];
  }

  selectCategory(category: string): void {
    this.activeCategory = category;
  }

  playChannel(channel: Channel): void {
    this.selectedChannel = channel;
  }
}
