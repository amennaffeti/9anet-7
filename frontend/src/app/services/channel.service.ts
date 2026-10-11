
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Channel {
  id: number;
  name: string;
  category: string;
  description: string | null;
  logoUrl: string | null;
  streamUrl: string | null;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChannelService {
  private http = inject(HttpClient);

  private apiUrl = 'http://localhost:8080/api/channels';

  getChannels(): Observable<Channel[]> {
    return this.http.get<Channel[]>(this.apiUrl);
  }
}
