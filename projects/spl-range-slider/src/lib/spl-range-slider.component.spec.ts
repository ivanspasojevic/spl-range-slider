import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SplRangeSliderComponent } from './spl-range-slider.component';

describe('RangeSliderComponent', () => {
  let component: SplRangeSliderComponent;
  let fixture: ComponentFixture<SplRangeSliderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplRangeSliderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SplRangeSliderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
