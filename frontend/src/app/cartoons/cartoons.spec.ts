import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cartoons } from './cartoons';

describe('Cartoons', () => {
  let component: Cartoons;
  let fixture: ComponentFixture<Cartoons>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cartoons],
    }).compileComponents();

    fixture = TestBed.createComponent(Cartoons);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
