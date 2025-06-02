import {DOCUMENT, NgStyle} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter, forwardRef,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  signal,
  WritableSignal,
  computed,
  effect
} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import { Subject } from 'rxjs';

import { RangeValue } from './range-value';

// Fix for Safari: re-assign type to satisfy safari browser in development mode
// https://stackoverflow.com/questions/58473921/why-cant-i-use-touchevent-in-safari
type AppTouchEvent = TouchEvent;

/**
 * @group Forms
 * @component Range Slider
 * @see https://github.com/angular/angular/issues/20351#issuecomment-344009887
 * @dynamic
 * @description
 * <div>Range Slider component</div>
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  selector: 'spl-range-slider',
  providers: [{provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(()=> SplRangeSliderComponent), multi: true }],
  imports: [
    NgStyle
  ],
  styleUrls: ['./spl-range-slider.component.css'],
  template: `
    <div class="spl-range-slider"
         (click)="onRangeClick($event)"
         (touchstart)="onRangeTouch($event)">
      <div #start
           (mousedown)="onDraggingStart($event, true)"
           (touchstart)="onDraggingStart($event, true)"
           (keydown)="onKeyDown($event, true)"
           tabindex="0"
           role="slider"
           class="spl-range-slider__handler start"
           [class.spl-range-slider__handler--is-moving]="isStartBullet() && isMoving()"
           [ngStyle]="startStyle()"
           [attr.aria-valuemin]="min"
           [attr.aria-valuemax]="max"
           [attr.aria-valuenow]="_value().start"
           aria-orientation="horizontal"
           aria-label="Start of range"></div>
      <div #progress class="spl-range-slider__group-line">
        <div class="spl-range-slider__progress" [ngStyle]="progressStyle"></div>
      </div>
      <div #end
           (mousedown)="onDraggingStart($event, false)"
           (touchstart)="onDraggingStart($event, false)"
           (keydown)="onKeyDown($event, false)"
           tabindex="0"
           role="slider"
           class="spl-range-slider__handler"
           [class.spl-range-slider__handler--is-moving]="!isStartBullet() && isMoving()"
           [ngStyle]="endStyle()"
           [attr.aria-valuemin]="min"
           [attr.aria-valuemax]="max"
           [attr.aria-valuenow]="_value().end"
           aria-orientation="horizontal"
           aria-label="End of range"></div>
      <div class="spl-range-slider__line-ghost"></div>
    </div>

  `
})
export class SplRangeSliderComponent
  implements ControlValueAccessor, AfterViewInit /*, OnDestroy // OnDestroy might not be needed */ {
  @Input() min = 0;

  @Input()
  max = 100;

  @Input()
  step = 1;

  @Input()
  minRange = 0;

  @Input()
  get value(): RangeValue {
    // Ensure this uses the signal getter
    return this._value();
  }

  set value(value: RangeValue) {
    // Ensure this uses the signal setter and checks for actual change
    if (value) { // Ensure value is not null/undefined before setting
      const currentSignalValue = this._value();
      if (value.start !== currentSignalValue.start || value.end !== currentSignalValue.end) {
        this._value.set({ ...value });
        // cdRef.markForCheck() might not be needed if the template reads the signal directly
      }
    }
  }

  @Output()
  readonly changed = new EventEmitter<RangeValue>();

  @Output()
  readonly slide = new EventEmitter<RangeValue>();

  @ViewChild('progress', { static: true })
  private progressRef: ElementRef | null = null;

  isMoving: WritableSignal<boolean> = signal(false);
  isStartBullet: WritableSignal<boolean> = signal(false);

  private _value: WritableSignal<RangeValue> = signal({ start: this.min, end: this.max });
  private pxPerUnit: WritableSignal<number> = signal(0);
  private progressDimensions: WritableSignal<DOMRect | null> = signal(null);
  private valueOnStart: WritableSignal<RangeValue | null> = signal(null);
  // private destroy: Subject<null> = new Subject<null>(); // Removed as effects handle their own cleanup or are tied to component lifecycle

  // private bulletSize = 20;

  constructor(
    private cdRef: ChangeDetectorRef, // cdRef might not be needed as much with signals
    @Inject(DOCUMENT) public document: Document
  ) {
    // Effect to react to changes in min, max, or progressRef and update progressDimensions and pxPerUnit
    effect(() => {
      const progressElem = this.progressRef?.nativeElement;
      if (progressElem) {
        const rect = progressElem.getBoundingClientRect();
        this.progressDimensions.set(rect);
        // Ensure min and max are read here to establish dependency
        const currentMin = this.min;
        const currentMax = this.max;
        if (currentMax > currentMin) {
          this.pxPerUnit.set(rect.width / (currentMax - currentMin));
        } else {
          this.pxPerUnit.set(0);
        }
      }
    });

    // Effect to react to min/max input changes and adjust _value
    effect(() => {
      const currentMin = this.min;
      const currentMax = this.max;
      const currentStep = this.step; // ensure step is positive
      const currentMinRange = this.minRange;

      this._value.update(val => {
        let newStart = Math.max(currentMin, Math.min(val.start, currentMax));
        let newEnd = Math.max(currentMin, Math.min(val.end, currentMax));

        // Ensure start and end are aligned with step
        newStart = Math.round((newStart - currentMin) / currentStep) * currentStep + currentMin;
        newEnd = Math.round((newEnd - currentMin) / currentStep) * currentStep + currentMin;

        // Ensure newStart is not greater than newEnd
        if (newStart > newEnd) {
          // This can happen if bounds shrink significantly. Prioritize newStart or newEnd based on some logic,
          // or reset to a default. For now, let's cap start at end.
          newStart = newEnd;
        }

        // Ensure minRange is respected
        if (newEnd - newStart < currentMinRange) {
          // Try to adjust newEnd first
          newEnd = newStart + currentMinRange;
          if (newEnd > currentMax) {
            // If newEnd exceeds max, adjust newStart instead
            newStart = currentMax - currentMinRange;
            newEnd = currentMax; // newEnd was already Math.min(val.end, currentMax)
          }
          // Ensure start is not less than min after adjustment
          newStart = Math.max(currentMin, newStart);
        }

        // Final clamping
        newStart = Math.max(currentMin, Math.min(newStart, currentMax));
        newEnd = Math.max(currentMin, Math.min(newEnd, currentMax));

        if (val.start !== newStart || val.end !== newEnd) {
          return { start: newStart, end: newEnd };
        }
        return val;
      });
    });
  }

  /**
   * Get max value of two min numbers.
   */
  static maxValue(value: number, min = 0, max = 1): number {
    return Math.max(min, Math.min(value, max));
  }

  ngAfterViewInit(): void {
    // Initial calculation of progress dimensions
    this.setProgressDimension();
  }

  // ngOnDestroy is no longer strictly necessary for destroying the Subject,
  // but can be kept if other explicit cleanup is needed.
  // ngOnDestroy(): void {
  //   this.destroy.next(null);
  //   this.destroy.complete();
  // }

  /********************* Event handlers *********************/

  /**
   * onTouch function registered via registerOnTouch (ControlValueAccessor).
   * is called when range slider has been touched.
   */
  onTouched: () => void = () => {};

  /**
   * onChangeFn function registered via registerOnTouch (ControlValueAccessor).
   * is called when value changes.
   */
  onChangeFn: (value: RangeValue | null) => void = () => {};

  @HostListener('document:mousemove', ['$event'])
  @HostListener('document:pointermove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.isMoving()) {
      return;
    }

    const oldValue = { ...this._value() } as RangeValue;
    this.updateValue(event.clientX);

    // if value didn't change, do nothing.
    if (this.isValueChanged(oldValue)) {
      this.slide.emit(this._value());
    }
    // this.cdRef.detectChanges(); // May not be needed with signals
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: AppTouchEvent): void {
    if (!this.isMoving()) {
      return;
    }

    const oldValue = { ...this._value() } as RangeValue;
    this.updateValue(event.touches[0].clientX);

    // if value didn't change, do nothing.
    if (this.isValueChanged(oldValue)) {
      this.slide.emit(this._value());
    }
  }

  @HostListener('document:touchend')
  @HostListener('document:mouseup')
  onDraggingEnd(): void {
    if (!this.isMoving()) {
      return;
    }

    const valueOnStart = this.valueOnStart();
    // reset values.
    this.isMoving.set(false);
    this.isStartBullet.set(false); // Resetting this, as onRangeClick/Touch will set it correctly.

    // if value didn't changed, do nothing.
    if (valueOnStart && this.isValueChanged(valueOnStart)) {
      this.emitChangeEvent();
    }
    this.onTouched(); // Mark as touched
    this.valueOnStart.set(null); // Clear the valueOnStart
  }

  onDraggingStart(event: Event, isStartHandler: boolean): void {
    event.stopPropagation();
    this.setProgressDimension(); // Ensure dimensions are up-to-date
    this.isMoving.set(true);
    this.isStartBullet.set(isStartHandler);
    this.valueOnStart.set({ ...this._value() });
  }

  onRangeClick(event: MouseEvent) {
    const currentProgressDimensions = this.progressDimensions();
    if (!currentProgressDimensions) {
      return;
    }

    const offset = currentProgressDimensions.left;
    const size = currentProgressDimensions.width;

    // Every click below 50% of progress bar size will update value for start bullet,
    // otherwise end bullet will be updated.
    this.isStartBullet.set(event.clientX - offset < size / 2);

    this.updateValue(event.clientX);
    this.slide.emit(this._value());
    this.emitChangeEvent();
    this.onTouched(); // Mark as touched

    // if (!this.isMoving()) { // This check might be redundant or handled by setProgressDimension itself
    //   this.setProgressDimension();
    // }
  }

  onRangeTouch(event: TouchEvent) {
    const currentProgressDimensions = this.progressDimensions();
    if (!currentProgressDimensions) {
      return;
    }

    const offset = currentProgressDimensions.left;
    const size = currentProgressDimensions.width;

    // Every click below 50% of progress bar size will update value for start bullet,
    // otherwise end bullet will be updated.
    this.isStartBullet.set(event.touches[0].clientX - offset < size / 2);

    this.updateValue(event.touches[0].clientX);
    this.slide.emit(this._value());
    this.emitChangeEvent();
    this.onTouched(); // Mark as touched

    // if (!this.isMoving()) { // Similar to onRangeClick
    //   this.setProgressDimension();
    // }
  }

  /********************* ControlValueAccessor *********************/

  writeValue(value: RangeValue | null | undefined): void {
    if (value != null) { // Check for null or undefined
      this._value.set({ ...value });
    } else {
      // Behavior for null/undefined input:
      // Current behavior is to keep the existing value if null/undefined is passed.
      // Alternatively, one could reset to default:
      // this._value.set({ start: this.min, end: this.max });
      // For now, maintaining existing behavior (do nothing if value is null/undefined).
      // If an explicit reset to default is desired when null is passed, that logic would go here.
      // For instance, to reset if null is explicitly passed:
      // if (value === null) {
      //   this._value.set({ start: this.min, end: this.max });
      // }
    }
  }

  registerOnChange(fn: (value: RangeValue | null) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /********************* Private members *********************/

  /**
   * Get the DOMRect of the time range element.
   */
  private getProgressDimensions(): DOMRect | null {
    return this.progressRef
      ? this.progressRef.nativeElement.getBoundingClientRect()
      : null;
  }

  /**
   * Set progressbar dimensions.
   * This method is called to explicitly trigger dimension recalculation.
   * The effect also handles this reactively, but explicit calls might be needed
   * if progressRef itself isn't changing but its dimensions are (e.g. window resize).
   */
  private setProgressDimension(): void {
    const progressElem = this.progressRef?.nativeElement;
    if (progressElem) {
      const rect = progressElem.getBoundingClientRect();
      this.progressDimensions.set(rect);
      if (this.max > this.min) {
        this.pxPerUnit.set(rect.width / (this.max - this.min));
      } else {
        this.pxPerUnit.set(0);
      }
    }
    // this.cdRef.detectChanges(); // May not be needed
  }

  /**
   * Compare old and new value object.
   * @param   oldValue Previous time range value
   * @returns true if object is changed, otherwise false.
   */
  private isValueChanged(oldValue: RangeValue): boolean {
    const currentValue = this._value();
    return (
      oldValue.start !== currentValue.start || oldValue.end !== currentValue.end
    );
  }

  /**
   * Emit changed value.
   */
  private emitChangeEvent(): void {
    this.onChangeFn(this._value());
    this.changed.emit(this._value());
  }

  /**
   * Update start/end value by bullet position.
   * @param x Mouse clientX position.
   */
  private updateValue(x: number): void {
    const currentProgressDimensions = this.progressDimensions();
    if (!currentProgressDimensions) {
      return;
    }

    const offset = currentProgressDimensions.left;
    const size = currentProgressDimensions.width;
    const percent = SplRangeSliderComponent.maxValue((x - offset) / size);

    if (this.isStartBullet()) {
      this.updateStartValue(percent);
    } else {
      this.updateEndValue(percent);
    }
  }

  /**
   * Update start value by bullet position.
   */
  private updateStartValue(percent: number): void {
    const currentValue = this._value();
    let newStart = currentValue.start;

    if (percent === 0) {
      newStart = this.min;
    } else if (percent === 1) {
      newStart = currentValue.end - this.minRange;
    } else if (currentValue.start < currentValue.end) {
      const value = this.calculateValue(percent);
      const roundedValue =
        Math.round((value - this.min) / this.step) * this.step + this.min;

      if (roundedValue <= currentValue.end - this.minRange) {
        newStart = SplRangeSliderComponent.maxValue(
          roundedValue,
          this.min,
          this.max
        );
      }
    }
    this._value.update(val => ({ ...val, start: newStart }));
  }

  /**
   * Update end value by bullet position.
   */
  private updateEndValue(percent: number): void {
    const currentValue = this._value();
    let newEnd = currentValue.end;

    if (percent === 0) {
      newEnd = currentValue.start + this.minRange;
    } else if (percent === 1) {
      newEnd = this.max;
    } else if (currentValue.end > currentValue.start) {
      const value = this.calculateValue(percent);
      const roundedValue =
        Math.round((value - this.min) / this.step) * this.step + this.min;

      if (roundedValue >= currentValue.start + this.minRange) {
        newEnd = SplRangeSliderComponent.maxValue(
          roundedValue,
          this.min,
          this.max
        );
      }
    }
    this._value.update(val => ({ ...val, end: newEnd }));
  }

  private calculateValue(percentage: number): number {
    return this.min + percentage * (this.max - this.min);
  }

  /**
   * Get value transformed to pixel
   */
  private calculatePixelValue(value: number): number {
    return (value - this.min) * this.pxPerUnit();
  }

  /********************* Keyboard Navigation *********************/
  onKeyDown(event: KeyboardEvent, isStartHandler: boolean): void {
    let newStartValue = this._value().start;
    let newEndValue = this._value().end;
    const currentStep = this.step; // Assuming this.step is a number, not a signal
    const currentMin = this.min;   // Assuming this.min is a number, not a signal
    const currentMax = this.max;   // Assuming this.max is a number, not a signal
    const currentMinRange = this.minRange; // Assuming this.minRange is a number
    let valueChanged = false;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        if (isStartHandler) {
          newStartValue = newStartValue - currentStep;
        } else {
          newEndValue = newEndValue - currentStep;
        }
        valueChanged = true;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        if (isStartHandler) {
          newStartValue = newStartValue + currentStep;
        } else {
          newEndValue = newEndValue + currentStep;
        }
        valueChanged = true;
        break;
      case 'Home':
        if (isStartHandler) {
          newStartValue = currentMin;
        } else { // Moves end handle to its minimum possible position relative to start
          newEndValue = newStartValue + currentMinRange;
        }
        valueChanged = true;
        break;
      case 'End':
        if (isStartHandler) { // Moves start handle to its maximum possible position relative to end
          newStartValue = newEndValue - currentMinRange;
        } else {
          newEndValue = currentMax;
        }
        valueChanged = true;
        break;
      default:
        return; // Exit if key is not handled
    }

    if (valueChanged) {
      event.preventDefault();
      event.stopPropagation();

      // Apply step to ensure new values are on a step increment
      // (already done for arrows, home/end might need it if min/max/minRange are not multiples of step)
      newStartValue = Math.round((newStartValue - currentMin) / currentStep) * currentStep + currentMin;
      newEndValue = Math.round((newEndValue - currentMin) / currentStep) * currentStep + currentMin;

      // Clamp new values to min/max bounds
      newStartValue = Math.max(currentMin, Math.min(newStartValue, currentMax));
      newEndValue = Math.max(currentMin, Math.min(newEndValue, currentMax));

      // Ensure minRange is respected
      if (isStartHandler) {
        // Adjust start value if it's too close to or past the end value minus minRange
        newStartValue = Math.min(newStartValue, newEndValue - currentMinRange);
      } else { // isEndHandler
        // Adjust end value if it's too close to or past the start value plus minRange
        newEndValue = Math.max(newEndValue, newStartValue + currentMinRange);
      }

      // Re-clamp after minRange adjustment because minRange logic might push values outside min/max
      newStartValue = Math.max(currentMin, Math.min(newStartValue, currentMax));
      newEndValue = Math.max(currentMin, Math.min(newEndValue, currentMax));

      // One final check: if start is now greater than end (can happen if minRange is large and step forces overlap)
      // Or if after all adjustments, they are still too close.
      // This logic is complex; the effect that reacts to min/max/step/minRange changes already has robust logic.
      // For keyboard, we primarily update one handle and ensure it doesn't violate obvious rules.
      // The existing effect will further refine/correct if needed.

      const currentVal = this._value();
      if (currentVal.start !== newStartValue || currentVal.end !== newEndValue) {
        // Only update if there's an actual change to avoid redundant updates/emits
        this._value.set({ start: newStartValue, end: newEndValue });
        this.slide.emit(this._value()); // Emit for continuous sliding feel
        this.emitChangeEvent(); // Emits 'changed' and calls CVA onChange
        this.onTouched(); // Mark as touched for CVA
      }
    }
  }

  /********************* CSS Styles *********************/

  // Using computed signals for styles
  readonly startStyle = computed(() => {
    // Reading _value and pxPerUnit establishes them as dependencies.
    const val = this._value();
    const pxVal = this.pxPerUnit();
    if (pxVal === 0 && this.min === this.max) return { transform: 'translateX(0px)'}; // Avoid NaN if min=max
    const translateX = (val.start - this.min) * pxVal;
    return {
      transform: `translateX(${translateX}px)`
    };
  });

  readonly endStyle = computed(() => {
    const currentProgressDimensions = this.progressDimensions();
    const val = this._value();
    const pxVal = this.pxPerUnit();
    if (!currentProgressDimensions) return { transform: 'translateX(0px)' };
    if (pxVal === 0 && this.min === this.max) return { transform: 'translateX(0px)'}; // Avoid NaN if min=max

    const calculatedValue = (val.end - this.min) * pxVal;
    const translateValue = currentProgressDimensions.width - calculatedValue;

    return {
      // transform: `translateX(-${value}px)` // Original logic
      transform: `translateX(${calculatedValue - currentProgressDimensions.width}px)` // Simplified, should be equivalent
    };
  });

  readonly progressStyle = computed(() => {
    const currentProgressDimensions = this.progressDimensions();
    if (!currentProgressDimensions || currentProgressDimensions.width === 0) {
      return { transform: 'translateX(0px) scaleX(0)'}; // Default sensible style
    }

    const currentVal = this._value();
    const currentMin = this.min;
    const currentMax = this.max;
    const pxVal = this.pxPerUnit();

    if (currentMax === currentMin) { // Avoid division by zero if min === max
        return { transform: 'translateX(0px) scaleX(0)' };
    }

    const startPx = (currentVal.start - currentMin) * pxVal;
    const endPx = (currentVal.end - currentMin) * pxVal;

    const width = endPx - startPx;
    // translateX should be to the start of the progress bar segment
    const translateX = startPx;
    // scaleX is the ratio of the current range width to the total possible range width
    // However, the original CSS used a different approach for translateX and scaleX.
    // Original:
    // const endPosition = currentProgressDimensions.width - this.calculatePixelValue(currentVal.end);
    // const translateX = (this.calculatePixelValue(currentVal.start) - endPosition) / 2;
    // const scaleX = (currentVal.start - currentVal.end) / (this.max - this.min);
    // This seems like it was trying to center a line and scale it.
    // A more direct approach for a progress bar:
    // X position is startPx, width is endPx - startPx.
    // The template has a single div for progress. It needs left and width.
    // Or, use translateX for left and scaleX for width/totalWidth.

    // Let's stick to a simpler model: left and width for the progress bar.
    // The existing template structure uses a single `spl-range-slider__progress` div.
    // It's styled with `transform: translateX() scaleX()`.
    // `translateX` moves the *center* of the scaled element.
    // `scaleX` scales it relative to its original width (implicitly 100% of parent if not set).

    // Re-evaluating the original transform:
    // If line's original width is full width of slider:
    // translateX = (startHandlePos + endHandlePos) / 2 - (sliderWidth / 2)
    // scaleX = (endHandlePos - startHandlePos) / sliderWidth

    const sliderWidth = currentProgressDimensions.width;
    const progressWidth = endPx - startPx;

    // If the .spl-range-slider__progress element is meant to span the entire track initially
    // and then be scaled and positioned:
    // Its center is at startPx + progressWidth / 2
    // The translateX needs to shift this center point.
    // Original scaleX was (start - end) which is negative. This implies the element might be
    // oriented in a specific way or the scale calculation was unusual.
    // A positive scaleX would be (currentVal.end - currentVal.start) / (currentMax - currentMin)
    // Let's try to match the original logic more closely first.

    const calculatedStartPixelValue = (currentVal.start - currentMin) * pxVal;
    const calculatedEndPixelValue = (currentVal.end - currentMin) * pxVal;

    // This is how far the right edge of the "end" handle is from the right of the slider.
    const endPositionFromRight = sliderWidth - calculatedEndPixelValue;

    // The original translateX was: (calculatedStartPixelValue - endPositionFromRight) / 2
    // This seems to be an attempt to find the midpoint between the start handle's left edge
    // and *what would be the left edge of a bar starting from the right and ending at the end handle*.
    // This is complex. Let's assume the progress bar div should visually start at `startPx` and have width `progressWidth`.
    // If we use translateX and scaleX on a div that's initially 100% width:
    // scaleX = progressWidth / sliderWidth
    // translateX = startPx (this would make the scaled div start at the correct visual point)

    // The original scaleX: (currentVal.start - currentVal.end) / (currentMax - currentMin)
    // This is -(currentVal.end - currentVal.start) / (currentMax - currentMin)
    // = - (progressWidthInValueUnits / totalWidthInValueUnits)
    // This negative scale factor means the element is flipped.
    // If an element is flipped, its translateX reference point also flips.

    // Let's try to simplify the meaning for the template:
    // `left: startPx + 'px'`, `width: progressWidth + 'px'` would be easiest.
    // But we must use transform.

    // If scaleX is negative, it means it's scaling from right-to-left or similar.
    // Let's use the direct values and see.
    // The progress bar should be between val.start and val.end.
    // Position of start of track: calculatedStartPixelValue
    // Width of track: calculatedEndPixelValue - calculatedStartPixelValue;

    // Original formula for translateX: ( (start-min)*pxPerUnit - (width - (end-min)*pxPerUnit) ) / 2
    // Original formula for scaleX: (start-end) / (max-min)
    // This is ( (startPx) - (sliderWidth - endPx) ) / 2
    // This is (startPx - sliderWidth + endPx) / 2
    // = ( (startPx + endPx) / 2 ) - (sliderWidth / 2)
    // This is: "midpoint of the active range" - "midpoint of the slider".
    // This correctly positions the center of the scaled element.

    const finalTranslateX = ((calculatedStartPixelValue + calculatedEndPixelValue) / 2) - (sliderWidth / 2);
    const finalScaleX = (currentVal.end - currentVal.start) / (currentMax - currentMin); // ensure positive scale

    // If the original scaleX was negative, it might have been to make a 100% width bar appear correct
    // when its "left" was effectively its "right" due to the flip.
    // If we use positive scale, translateX should be to the true midpoint.

    return {
      // transform: `translateX(${translateX}px) scaleX(${scaleX})` // Original line commented out
      transform: `translateX(${finalTranslateX}px) scaleX(${finalScaleX})`
    };
  });
}
