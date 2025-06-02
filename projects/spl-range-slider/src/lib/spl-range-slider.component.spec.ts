import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SplRangeSliderComponent } from './spl-range-slider.component';

import { DebugElement } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RangeValue } from './range-value';

import { SplRangeSliderComponent } from './spl-range-slider.component';

describe('SplRangeSliderComponent', () => {
  let component: SplRangeSliderComponent;
  let fixture: ComponentFixture<SplRangeSliderComponent>;
  let startHandlerDebugEl: DebugElement;
  let endHandlerDebugEl: DebugElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplRangeSliderComponent], // It's a standalone component
    }).compileComponents();

    fixture = TestBed.createComponent(SplRangeSliderComponent);
    component = fixture.componentInstance;
    // Initial fixture.detectChanges() is called to trigger ngOnInit and initial rendering.
    // For components with signals and OnPush, fixture.detectChanges() is crucial to propagate changes.
    fixture.detectChanges();

    startHandlerDebugEl = fixture.debugElement.query(By.css('.spl-range-slider__handler.start'));
    endHandlerDebugEl = fixture.debugElement.query(By.css('.spl-range-slider__handler:not(.start)'));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initial State and Inputs', () => {
    it('should have default input values', () => {
      expect(component.min).toBe(0);
      expect(component.max).toBe(100);
      expect(component.step).toBe(1);
      expect(component.minRange).toBe(0);
    });

    it('should initialize _value signal based on default inputs', () => {
      expect(component.value).toEqual({ start: 0, end: 100 }); // Uses getter that accesses signal
    });

    it('should initialize _value signal based on provided inputs', () => {
      component.min = 10;
      component.max = 90;
      component.value = { start: 20, end: 80 }; // Set through input setter
      fixture.detectChanges(); // For effect to run if min/max changes affect value, and for @Input binding

      // The effect for min/max changes might run and adjust the value if it's outside new bounds
      // or not aligned with step. Here, 20/80 is fine for min 10, max 90, step 1.
      expect(component.value).toEqual({ start: 20, end: 80 });
    });

    it('should allow min and max to be equal', () => {
      component.min = 50;
      component.max = 50;
      fixture.detectChanges();
      // The effect that adjusts _value based on min/max changes will run.
      // Expect value to be { start: 50, end: 50 }
      expect(component.value).toEqual({ start: 50, end: 50 });
    });
  });

  describe('ARIA Attributes', () => {
    it('should have correct static ARIA attributes on handles', () => {
      expect(startHandlerDebugEl.attributes['role']).toBe('slider');
      expect(startHandlerDebugEl.attributes['aria-orientation']).toBe('horizontal');
      expect(startHandlerDebugEl.attributes['tabindex']).toBe('0');

      expect(endHandlerDebugEl.attributes['role']).toBe('slider');
      expect(endHandlerDebugEl.attributes['aria-orientation']).toBe('horizontal');
      expect(endHandlerDebugEl.attributes['tabindex']).toBe('0');
    });

    it('should bind aria-valuemin and aria-valuemax to min and max inputs', () => {
      component.min = 10;
      component.max = 90;
      fixture.detectChanges();
      expect(startHandlerDebugEl.attributes['aria-valuemin']).toBe('10');
      expect(startHandlerDebugEl.attributes['aria-valuemax']).toBe('90');
      expect(endHandlerDebugEl.attributes['aria-valuemin']).toBe('10');
      expect(endHandlerDebugEl.attributes['aria-valuemax']).toBe('90');
    });

    it('should update aria-valuenow when value changes', () => {
      component.value = { start: 25, end: 75 };
      fixture.detectChanges();
      expect(startHandlerDebugEl.attributes['aria-valuenow']).toBe('25');
      expect(endHandlerDebugEl.attributes['aria-valuenow']).toBe('75');

      component.value = { start: 30, end: 70 };
      fixture.detectChanges();
      expect(startHandlerDebugEl.attributes['aria-valuenow']).toBe('30');
      expect(endHandlerDebugEl.attributes['aria-valuenow']).toBe('70');
    });
  });

  describe('ControlValueAccessor Implementation', () => {
    it('should set value correctly with writeValue', () => {
      const newValue: RangeValue = { start: 10, end: 90 };
      component.writeValue(newValue);
      fixture.detectChanges();
      expect(component.value).toEqual(newValue);
    });

    it('should handle null/undefined in writeValue by keeping existing value', () => {
      const initialValue = component.value; // e.g., { start: 0, end: 100 }
      component.writeValue(null);
      fixture.detectChanges();
      expect(component.value).toEqual(initialValue);

      component.writeValue(undefined);
      fixture.detectChanges();
      expect(component.value).toEqual(initialValue);
    });

    it('should register onChange function', () => {
      const onChangeSpy = jasmine.createSpy('onChangeFn');
      component.registerOnChange(onChangeSpy);

      // Simulate a value change that would call onChangeFn (e.g. via emitChangeEvent)
      // For this test, directly call emitChangeEvent as it's a public method used internally.
      // Or, better, simulate user interaction.
      // For simplicity here, let's assume emitChangeEvent is the point where onChangeFn is called.
      component.value = { start: 5, end: 95}; // This will update _value()
      fixture.detectChanges(); // Propagate change
      (component as any).emitChangeEvent(); // Manually trigger for test - ideally simulate user action

      expect(onChangeSpy).toHaveBeenCalledWith({ start: 5, end: 95 });
    });

    it('should register onTouched function and call it on interaction', fakeAsync(() => {
      const onTouchedSpy = jasmine.createSpy('onTouchedFn');
      component.registerOnTouched(onTouchedSpy);

      // Simulate a blur or specific interaction that calls onTouched
      // For example, onDraggingEnd calls onTouched.
      // Here, we'll directly call onDraggingEnd for simplicity of this specific CVA test.
      // Assume a drag occurred:
      component.isMoving.set(true);
      component.valueOnStart.set({start: 0, end: 100});
      component.value = {start: 10, end: 90}; // value changed during mock drag
      fixture.detectChanges();

      component.onDraggingEnd(); // This should call onTouched
      tick(); // If there are any async operations or effects

      expect(onTouchedSpy).toHaveBeenCalled();
    }));
  });

  // More tests for Keyboard Navigation, Mouse Interactions, Edge Cases, etc. will follow.

  describe('Keyboard Navigation', () => {
    let onChangeSpy: jasmine.Spy;
    let onTouchedSpy: jasmine.Spy;

    beforeEach(() => {
      onChangeSpy = jasmine.createSpy('onChangeFn');
      onTouchedSpy = jasmine.createSpy('onTouchedFn');
      component.registerOnChange(onChangeSpy);
      component.registerOnTouched(onTouchedSpy);
    });

    function dispatchKeyDownEvent(element: DebugElement, key: string) {
      element.triggerEventHandler('keydown', new KeyboardEvent('keydown', { key }));
      fixture.detectChanges();
    }

    it('should decrease start handle value with ArrowLeft', () => {
      component.value = { start: 50, end: 80 };
      component.step = 5;
      fixture.detectChanges(); // Ensure initial value is set and detected

      dispatchKeyDownEvent(startHandlerDebugEl, 'ArrowLeft');
      expect(component.value).toEqual({ start: 45, end: 80 });
      expect(onChangeSpy).toHaveBeenCalledWith({ start: 45, end: 80 });
      expect(onTouchedSpy).toHaveBeenCalled();
    });

    it('should increase start handle value with ArrowRight', () => {
      component.value = { start: 50, end: 80 };
      component.step = 5;
      fixture.detectChanges();

      dispatchKeyDownEvent(startHandlerDebugEl, 'ArrowRight');
      expect(component.value).toEqual({ start: 55, end: 80 });
    });

    it('should decrease end handle value with ArrowLeft', () => {
      component.value = { start: 20, end: 50 };
      component.step = 5;
      fixture.detectChanges();

      dispatchKeyDownEvent(endHandlerDebugEl, 'ArrowLeft');
      expect(component.value).toEqual({ start: 20, end: 45 });
    });

    it('should increase end handle value with ArrowRight', () => {
      component.value = { start: 20, end: 50 };
      component.step = 5;
      fixture.detectChanges();

      dispatchKeyDownEvent(endHandlerDebugEl, 'ArrowRight');
      expect(component.value).toEqual({ start: 20, end: 55 });
    });

    it('should set start handle to min with Home key', () => {
      component.min = 0;
      component.value = { start: 50, end: 80 };
      fixture.detectChanges();

      dispatchKeyDownEvent(startHandlerDebugEl, 'Home');
      expect(component.value.start).toBe(0);
    });

    it('should set end handle to max with End key', () => {
      component.max = 100;
      component.value = { start: 20, end: 50 };
      fixture.detectChanges();

      dispatchKeyDownEvent(endHandlerDebugEl, 'End');
      expect(component.value.end).toBe(100);
    });

    it('should respect minRange when moving start handle with ArrowRight', () => {
      component.value = { start: 50, end: 55 };
      component.step = 1;
      component.minRange = 5; // start cannot go beyond end - minRange (55 - 5 = 50)
      fixture.detectChanges();

      dispatchKeyDownEvent(startHandlerDebugEl, 'ArrowRight');
      expect(component.value).toEqual({ start: 50, end: 55 }); // Should not change
    });

    it('should respect minRange when moving end handle with ArrowLeft', () => {
      component.value = { start: 50, end: 55 };
      component.step = 1;
      component.minRange = 5; // end cannot go below start + minRange (50 + 5 = 55)
      fixture.detectChanges();

      dispatchKeyDownEvent(endHandlerDebugEl, 'ArrowLeft');
      expect(component.value).toEqual({ start: 50, end: 55 }); // Should not change
    });

    it('should set start handle to end - minRange with End key if it would violate minRange', () => {
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.minRange = 10;
      component.value = { start: 0, end: 5 }; // end is 5, so start should go to 5-10 = -5, but clamped by min 0.
                                             // The onKeyDown logic for start handle 'End' key is `newStartValue = newEndValue - currentMinRange;`
      fixture.detectChanges();
      dispatchKeyDownEvent(startHandlerDebugEl, 'End');
      // newStartValue will be 5 - 10 = -5. Clamped by min(0) and step(1) alignment => 0.
      // Then, it's clamped by newEndValue(5) - minRange(10) = -5.
      // Final clamping Math.max(0, Math.min(-5, 100)) = 0.
      // Then the last check: if (newEndValue - newStartValue < currentMinRange) -> if (5 - 0 < 10) is true.
      // newStartValue = newEndValue - currentMinRange = 5 - 10 = -5. Re-clamped to 0.
      expect(component.value.start).toBe(0); // Stays at 0 because endValue is 5, end-minRange = -5, clamped to 0.
    });

    it('should set end handle to start + minRange with Home key if it would violate minRange', () => {
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.minRange = 10;
      component.value = { start: 95, end: 100 }; // start is 95
                                               // The onKeyDown logic for end handle 'Home' key is `newEndValue = newStartValue + currentMinRange;`
      fixture.detectChanges();
      dispatchKeyDownEvent(endHandlerDebugEl, 'Home');
      // newEndValue will be 95 + 10 = 105. Clamped by max(100) and step(1) alignment => 100.
      // Then, it's clamped by newStartValue(95) + minRange(10) = 105.
      // Final clamping Math.max(0, Math.min(105, 100)) = 100.
      // Then the last check: if (newEndValue - newStartValue < currentMinRange) -> if (100 - 95 < 10) is true.
      // newEndValue = newStartValue + currentMinRange = 95 + 10 = 105. Re-clamped to 100.
      expect(component.value.end).toBe(100); // Stays at 100 because startValue is 95, start+minRange = 105, clamped to 100.
    });

    // Test ArrowUp and ArrowDown (should behave like ArrowRight and ArrowLeft)
    it('should increase start handle value with ArrowUp', () => {
      component.value = { start: 50, end: 80 };
      component.step = 5;
      fixture.detectChanges();
      dispatchKeyDownEvent(startHandlerDebugEl, 'ArrowUp');
      expect(component.value).toEqual({ start: 55, end: 80 });
    });

    it('should decrease end handle value with ArrowDown', () => {
      component.value = { start: 20, end: 50 };
      component.step = 5;
      fixture.detectChanges();
      dispatchKeyDownEvent(endHandlerDebugEl, 'ArrowDown');
      expect(component.value).toEqual({ start: 20, end: 45 });
    });
  });

  describe('Mouse Interactions', () => {
    let onChangeSpy: jasmine.Spy;
    let onTouchedSpy: jasmine.Spy;
    let progressElement: HTMLElement;

    beforeEach(() => {
      onChangeSpy = jasmine.createSpy('onChangeFn');
      onTouchedSpy = jasmine.createSpy('onTouchedFn');
      component.registerOnChange(onChangeSpy);
      component.registerOnTouched(onTouchedSpy);

      // Mock getBoundingClientRect for the progress bar
      progressElement = (component as any).progressRef.nativeElement as HTMLElement;
      spyOn(progressElement, 'getBoundingClientRect').and.returnValue({
        left: 0,
        top: 0,
        width: 1000, // Assuming a 1000px wide bar for easy percentage calculation
        height: 2,
        right: 1000,
        bottom: 2,
        x: 0,
        y: 0,
        toJSON: () => ({ left: 0, top: 0, width: 1000, height: 2, right: 1000, bottom: 2, x: 0, y: 0})
      });

      // Call setProgressDimension manually after mock because ngAfterViewInit might have run before mock
      // or if view isn't stable yet.
      // Also, ngAfterViewInit in test runs once. If inputs change affecting dimensions, this needs re-evaluation.
      component.min = 0;
      component.max = 100;
      fixture.detectChanges(); // Ensure min/max are set
      (component as any).setProgressDimension(); // This will use the mocked getBoundingClientRect
      fixture.detectChanges(); // Allow effects depending on pxPerUnit to run
    });

    it('should update value on track click (closer to start)', () => {
      // Slider from 0 to 100, track width 1000px. Click at 250px (25%)
      // Expect start handle to move to 25.
      const clickEvent = new MouseEvent('click', { clientX: 250 });
      fixture.debugElement.query(By.css('.spl-range-slider')).triggerEventHandler('click', clickEvent);
      fixture.detectChanges();

      expect(component.value.start).toBe(25);
      expect(onChangeSpy).toHaveBeenCalledWith(component.value); // Check exact value if needed
      expect(onTouchedSpy).toHaveBeenCalled();
    });

    it('should update value on track click (closer to end)', () => {
      // Slider from 0 to 100, track width 1000px. Click at 750px (75%)
      // Expect end handle to move to 75.
      component.value = { start: 0, end: 100 }; // Reset to full range
      fixture.detectChanges();
      (component as any).setProgressDimension(); // Recalculate with current value
      fixture.detectChanges();


      const clickEvent = new MouseEvent('click', { clientX: 750 });
      fixture.debugElement.query(By.css('.spl-range-slider')).triggerEventHandler('click', clickEvent);
      fixture.detectChanges();

      expect(component.value.end).toBe(75);
      expect(onChangeSpy).toHaveBeenCalledWith(component.value);
      expect(onTouchedSpy).toHaveBeenCalled();
    });

    // Dragging tests
    function simulateDrag(
      handle: DebugElement,
      startX: number,
      endX: number,
      isStartHandle: boolean
    ) {
      handle.triggerEventHandler('mousedown', new MouseEvent('mousedown', { clientX: startX }));
      fixture.detectChanges(); // To update isMoving state

      // Check if dragging started
      expect(component.isMoving()).toBe(true);
      expect(component.isStartBullet()).toBe(isStartHandle);

      // Simulate mousemove
      const moveEvent = new MouseEvent('mousemove', { clientX: endX });
      // Mousemove is on document, so trigger on document or window
      document.dispatchEvent(moveEvent);
      fixture.detectChanges();

      // Simulate mouseup
      const upEvent = new MouseEvent('mouseup');
      document.dispatchEvent(upEvent);
      fixture.detectChanges();

      expect(component.isMoving()).toBe(false);
    }

    it('should drag the start handle', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.value = { start: 20, end: 80 };
      fixture.detectChanges();
      (component as any).setProgressDimension(); // Recalculate pxPerUnit
       tick(); // allow effects to run

      const slideSpy = spyOn(component.slide, 'emit');

      // Drag start handle from its current position (20% -> 200px) to 30% (300px)
      // Initial clientX for mousedown doesn't determine start value, but subsequent mousemoves do.
      // Let's assume mousedown is at where the handle is (200px for value 20)
      // And drag it to 300px (which should be value 30)
      simulateDrag(startHandlerDebugEl, 200, 300, true);
      tick(); // For any debounces or async operations in event handlers

      expect(component.value.start).toBe(30);
      expect(slideSpy).toHaveBeenCalled(); // slide should be called during mousemove
      expect(onChangeSpy).toHaveBeenCalledWith({ start: 30, end: 80 });
      expect(onTouchedSpy).toHaveBeenCalled();
    }));

    it('should drag the end handle', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.value = { start: 20, end: 80 };
      fixture.detectChanges();
      (component as any).setProgressDimension();
      tick();

      const slideSpy = spyOn(component.slide, 'emit');

      // Drag end handle from 80% (800px) to 70% (700px)
      simulateDrag(endHandlerDebugEl, 800, 700, false);
      tick();

      expect(component.value.end).toBe(70);
      expect(slideSpy).toHaveBeenCalled();
      expect(onChangeSpy).toHaveBeenCalledWith({ start: 20, end: 70 });
      expect(onTouchedSpy).toHaveBeenCalled();
    }));

    it('should respect minRange when dragging start handle', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.minRange = 10; // End is 80, so start cannot go beyond 70.
      component.value = { start: 20, end: 80 };
      fixture.detectChanges();
      (component as any).setProgressDimension();
      tick();

      // Attempt to drag start handle from 200px to 750px (value 75)
      // This would make start=75, end=80. Range is 5, which is < minRange 10.
      // So, start should be capped at 80 - 10 = 70.
      simulateDrag(startHandlerDebugEl, 200, 750, true);
      tick();

      expect(component.value.start).toBe(70); // 80 (end) - 10 (minRange)
    }));

    it('should respect minRange when dragging end handle', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.minRange = 10; // Start is 20, so end cannot go below 30.
      component.value = { start: 20, end: 80 };
      fixture.detectChanges();
      (component as any).setProgressDimension();
      tick();

      // Attempt to drag end handle from 800px to 250px (value 25)
      // This would make start=20, end=25. Range is 5, which is < minRange 10.
      // So, end should be capped at 20 + 10 = 30.
      simulateDrag(endHandlerDebugEl, 800, 250, false);
      tick();

      expect(component.value.end).toBe(30); // 20 (start) + 10 (minRange)
    }));
  });

  describe('Dynamic Input Updates and Effects', () => {
    beforeEach(fakeAsync(() => {
      // Ensure progressRef is mocked for setProgressDimension calls triggered by effects
      const progressElement = (component as any).progressRef.nativeElement as HTMLElement;
      spyOn(progressElement, 'getBoundingClientRect').and.returnValue({
        left: 0, top: 0, width: 1000, height: 2, right: 1000, bottom: 2, x: 0, y: 0,
        toJSON: () => ({ left: 0, top: 0, width: 1000, height: 2, right: 1000, bottom: 2, x: 0, y: 0})
      });
      component.min = 0;
      component.max = 100;
      component.value = { start: 20, end: 80 };
      fixture.detectChanges(); // Initial inputs
      tick(); // Allow effects to run for initial setup
    }));

    it('should update value when min input changes and value is out of new bounds', fakeAsync(() => {
      component.min = 30; // Old start was 20, should be adjusted to 30
      fixture.detectChanges();
      tick(); // Allow effect to run
      expect(component.value.start).toBe(30);
    }));

    it('should update value when max input changes and value is out of new bounds', fakeAsync(() => {
      component.max = 70; // Old end was 80, should be adjusted to 70
      fixture.detectChanges();
      tick();
      expect(component.value.end).toBe(70);
    }));

    it('should realign value to step when step input changes', fakeAsync(() => {
      component.value = { start: 22, end: 78 };
      fixture.detectChanges();
      tick();
      expect(component.value).toEqual({ start: 22, end: 78 }); // Initial

      component.step = 5;
      fixture.detectChanges();
      tick(); // Allow effect to run
      // Start 22 should go to 20 or 25. The logic is Math.round((val - min) / step) * step + min
      // (22-0)/5 = 4.4, Math.round(4.4) = 4. 4*5+0 = 20.
      // (78-0)/5 = 15.6, Math.round(15.6) = 16. 16*5+0 = 80.
      expect(component.value).toEqual({ start: 20, end: 80 });
    }));

    it('should adjust value if minRange changes and current range is smaller', fakeAsync(() => {
      component.value = { start: 40, end: 50 }; // current range is 10
      fixture.detectChanges();
      tick();

      component.minRange = 20;
      fixture.detectChanges();
      tick(); // Allow effect to run
      // The effect logic tries to adjust newEnd first: newEnd = newStart + newMinRange = 40 + 20 = 60
      expect(component.value).toEqual({ start: 40, end: 60 });
    }));

    it('should adjust value respecting max if minRange pushes end out of bounds', fakeAsync(() => {
      component.value = { start: 90, end: 95 }; // current range is 5, max is 100
      fixture.detectChanges();
      tick();

      component.minRange = 15; // newEnd = 90 + 15 = 105. This is > max (100).
      fixture.detectChanges();
      tick();
      // Effect: newEnd becomes 105. Then it sees newEnd > max.
      // newStart becomes max - newMinRange = 100 - 15 = 85. newEnd becomes 100.
      expect(component.value).toEqual({ start: 85, end: 100 });
    }));
  });

  describe('Style Signal Reactivity', () => {
    beforeEach(fakeAsync(() => {
      const progressElement = (component as any).progressRef.nativeElement as HTMLElement;
      spyOn(progressElement, 'getBoundingClientRect').and.returnValue({
        left: 0, top: 0, width: 1000, height: 2, right: 1000, bottom: 2, x: 0, y: 0,
        toJSON: () => ({ left: 0, top: 0, width: 1000, height: 2, right: 1000, bottom: 2, x: 0, y: 0})
      });
      component.min = 0;
      component.max = 100; // 1000px width / (100-0) value range = 10px per unit for pxPerUnit
      fixture.detectChanges(); // To apply inputs
      (component as any).setProgressDimension(); // To calculate pxPerUnit
      tick(); // Ensure effects related to pxPerUnit run
    }));

    it('startStyle should update when value.start changes', fakeAsync(() => {
      component.value = { start: 10, end: 90 };
      fixture.detectChanges();
      tick();
      // pxPerUnit = 1000 / 100 = 10. translateX = (10 - 0) * 10 = 100px.
      expect(component.startStyle().transform).toBe('translateX(100px)');

      component.value = { start: 15, end: 90 };
      fixture.detectChanges();
      tick();
      // translateX = (15 - 0) * 10 = 150px.
      expect(component.startStyle().transform).toBe('translateX(150px)');
    }));

    it('endStyle should update when value.end changes', fakeAsync(() => {
      component.value = { start: 10, end: 90 }; // end is 90
      fixture.detectChanges();
      tick();
      // calculatedValue = (90 - 0) * 10 = 900.
      // transform = translateX(900 - 1000) = translateX(-100px)
      expect(component.endStyle().transform).toBe('translateX(-100px)');

      component.value = { start: 10, end: 80 }; // end is 80
      fixture.detectChanges();
      tick();
      // calculatedValue = (80 - 0) * 10 = 800.
      // transform = translateX(800 - 1000) = translateX(-200px)
      expect(component.endStyle().transform).toBe('translateX(-200px)');
    }));

    it('progressStyle should update when value changes', fakeAsync(() => {
      component.value = { start: 10, end: 90 }; // range 80
      fixture.detectChanges();
      tick();
      // calculatedStartPixelValue = (10-0)*10 = 100
      // calculatedEndPixelValue = (90-0)*10 = 900
      // sliderWidth = 1000
      // finalTranslateX = ((100 + 900) / 2) - (1000 / 2) = 500 - 500 = 0
      // finalScaleX = (90 - 10) / (100 - 0) = 80 / 100 = 0.8
      expect(component.progressStyle().transform).toBe('translateX(0px) scaleX(0.8)');

      component.value = { start: 20, end: 80 }; // range 60
      fixture.detectChanges();
      tick();
      // calculatedStartPixelValue = 200
      // calculatedEndPixelValue = 800
      // finalTranslateX = ((200 + 800) / 2) - (1000 / 2) = 500 - 500 = 0
      // finalScaleX = (80 - 20) / 100 = 0.6
      expect(component.progressStyle().transform).toBe('translateX(0px) scaleX(0.6)');
    }));

    it('progressStyle should handle min === max correctly', fakeAsync(() => {
      component.min = 50;
      component.max = 50;
      component.value = { start: 50, end: 50 };
      fixture.detectChanges();
      (component as any).setProgressDimension(); // Recalculate pxPerUnit, should be 0
      tick();

      // Expect scaleX to be 0 and translateX to be 0 or a non-NaN value
      const progressStyle = component.progressStyle();
      expect(progressStyle.transform).toContain('scaleX(0)');
      expect(progressStyle.transform).not.toContain('NaN');
    }));
  });

  describe('Edge Cases', () => {
    beforeEach(fakeAsync(() => {
      const progressElement = (component as any).progressRef.nativeElement as HTMLElement;
      spyOn(progressElement, 'getBoundingClientRect').and.returnValue({
        left: 0, top: 0, width: 1000, height: 2, right: 1000, bottom: 2, x: 0, y: 0,
        toJSON: () => ({ left: 0, top: 0, width: 1000, height: 2, right: 1000, bottom: 2, x: 0, y: 0})
      });
      // Default setup that can be overridden in specific tests
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.minRange = 0;
      component.value = { start: 0, end: 100 };
      fixture.detectChanges();
      tick();
    }));

    it('should handle minRange being equal to max - min', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.minRange = 100;
      // The effect for min/max/minRange changes should adjust the value.
      // If initial value was {0, 100}, it should remain {0,100}.
      // If initial value was different, e.g. {20,80}, effect should fix it.
      component.value = { start: 20, end: 80 }; // Set a value that would be changed by effect
      fixture.detectChanges();
      tick();
      expect(component.value).toEqual({ start: 0, end: 100 });

      // Attempt to move start handle right
      startHandlerDebugEl.triggerEventHandler('keydown', new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      fixture.detectChanges();
      tick();
      expect(component.value).toEqual({ start: 0, end: 100 }); // Should not change

      // Attempt to move end handle left
      endHandlerDebugEl.triggerEventHandler('keydown', new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      fixture.detectChanges();
      tick();
      expect(component.value).toEqual({ start: 0, end: 100 }); // Should not change
    }));

    it('should handle large step values correctly for click', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.step = 50;
      component.value = { start: 0, end: 100 };
      fixture.detectChanges();
      (component as any).setProgressDimension(); // Recalculate pxPerUnit for new step/min/max
      tick();

      // Click at 200px (value 20). Should snap to 0 or 50.
      // isStartBullet will be true. Start handle moves.
      // updateStartValue: roundedValue = Math.round((20-0)/50)*50+0 = Math.round(0.4)*50 = 0*50 = 0.
      const clickEvent1 = new MouseEvent('click', { clientX: 200 });
      fixture.debugElement.query(By.css('.spl-range-slider')).triggerEventHandler('click', clickEvent1);
      fixture.detectChanges();
      tick();
      expect(component.value.start).toBe(0);

      // Click at 700px (value 70). Should snap to 50 or 100.
      // isStartBullet will be false. End handle moves.
      // updateEndValue: roundedValue = Math.round((70-0)/50)*50+0 = Math.round(1.4)*50 = 1*50 = 50.
      const clickEvent2 = new MouseEvent('click', { clientX: 700 });
      fixture.debugElement.query(By.css('.spl-range-slider')).triggerEventHandler('click', clickEvent2);
      fixture.detectChanges();
      tick();
      expect(component.value.end).toBe(50);
    }));

    it('should handle large step values correctly for keyboard', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.step = 50;
      component.value = { start: 0, end: 100 };
      fixture.detectChanges();
      tick();

      startHandlerDebugEl.triggerEventHandler('keydown', new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      fixture.detectChanges();
      tick();
      expect(component.value).toEqual({ start: 50, end: 100 });

      endHandlerDebugEl.triggerEventHandler('keydown', new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      fixture.detectChanges();
      tick();
      expect(component.value).toEqual({ start: 50, end: 50 });
    }));

    it('should correctly initialize and adjust value when minRange is initially violated by input value', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.minRange = 20;
      // Set value directly (as if by @Input) that violates minRange
      component.value = { start: 10, end: 15 };
      fixture.detectChanges(); // Triggers @Input set and then effects
      tick(); // Allow effects to run

      // The effect logic: newStart=10, newEnd=15.
      // newEnd - newStart (5) < minRange (20) is true.
      // newEnd = newStart + minRange = 10 + 20 = 30.
      // Result: {start: 10, end: 30}
      expect(component.value).toEqual({ start: 10, end: 30 });
    }));

    it('should handle setting value to exact min/max when minRange is 0', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.step = 1;
      component.minRange = 0;
      component.value = { start: 0, end: 0 };
      fixture.detectChanges();
      tick();
      expect(component.value).toEqual({ start: 0, end: 0 });

      component.value = { start: 100, end: 100 };
      fixture.detectChanges();
      tick();
      expect(component.value).toEqual({ start: 100, end: 100 });
    }));

    it('should not allow handles to cross when dragging, even with step > minRange', fakeAsync(() => {
      component.min = 0;
      component.max = 100;
      component.step = 10;
      component.minRange = 5;
      component.value = { start: 40, end: 60 };
      fixture.detectChanges();
      (component as any).setProgressDimension();
      tick();

      // Drag start handle from 40 (400px) towards end (600px). Try to drag to 580px (value 58).
      // Value 58, step 10 -> rounds to 60.
      // newStartValue = 60. This would violate minRange if end is 60 (60 > 60 - 5).
      // updateStartValue logic: roundedValue = 60. if (60 <= 60 - 5) is false. So newStart remains 40.
      // Let's trace the drag:
      // initial value {40,60}. Drag start from 400px to 580px (value 58).
      // updateStartValue(0.58)
      //   currentValue = {40,60}, calculatedValue = 58, roundedValue = 60 (Math.round((58-0)/10)*10+0)
      //   if (roundedValue <= currentValue.end - currentMinRange) -> if (60 <= 60 - 5) -> if (60 <= 55) is false.
      //   So, _value.start does not change from 40 in this specific path.
      // This means the drag to 58 (which becomes 60) is denied because 60 is not <= 55.
      // Let's re-check component's updateStartValue logic:
      // if (roundedValue <= currentValue.end - this.minRange) newStart = roundedValue;
      // So if roundedValue is 60, current end is 60, minRange is 5. 60 <= (60-5) is false. So newStart is NOT updated.
      // This is correct. The start handle should not move to 60. Max it can go is 50 (step aligned) or 55 (if minRange allowed).
      // Max start = end - minRange = 60 - 5 = 55. Step aligned from 55 downwards is 50.

      const mousedownEvent = new MouseEvent('mousedown', { clientX: 400 }); // Corresponds to value 40
      startHandlerDebugEl.triggerEventHandler('mousedown', mousedownEvent);
      fixture.detectChanges();

      const mousemoveEvent = new MouseEvent('mousemove', { clientX: 580 }); // Attempt to move to value 58
      document.dispatchEvent(mousemoveEvent);
      fixture.detectChanges();
      tick();
      // Value 58, step 10, rounds to 60.
      // Start handle wants to go to 60. End handle is 60. minRange is 5.
      // updateStartValue -> roundedValue = 60.
      // if (60 <= 60 - 5) is false. So start value is not updated.
      expect(component.value.start).toBe(40); // Remains unchanged.

      // Try to drag to 540px (value 54, rounds to 50)
      const mousemoveEvent2 = new MouseEvent('mousemove', { clientX: 540 });
      document.dispatchEvent(mousemoveEvent2);
      fixture.detectChanges();
      tick();
      // updateStartValue -> roundedValue = 50.
      // if (50 <= 60 - 5) -> if (50 <= 55) is true. So start becomes 50.
      expect(component.value.start).toBe(50);

      const mouseupEvent = new MouseEvent('mouseup');
      document.dispatchEvent(mouseupEvent);
      fixture.detectChanges();
    }));

  });
});
