import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChannelPlayer } from './channel-player';

describe('ChannelPlayer', () => {
  let component: ChannelPlayer;
  let fixture: ComponentFixture<ChannelPlayer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelPlayer],
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelPlayer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
