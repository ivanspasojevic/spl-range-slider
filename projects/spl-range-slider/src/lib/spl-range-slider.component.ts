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
  ViewChild
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
           class="spl-range-slider__handler start"
           [class.spl-range-slider__handler--is-moving]="isStartBullet && isMoving"
           [ngStyle]="startStyle"></div>
      <div #progress class="spl-range-slider__group-line">
        <div class="spl-range-slider__progress" [ngStyle]="progressStyle"></div>
      </div>
      <div #end
           (mousedown)="onDraggingStart($event, false)"
           (touchstart)="onDraggingStart($event, false)"
           class="spl-range-slider__handler"
           [class.spl-range-slider__handler--is-moving]="!isStartBullet && isMoving"
           [ngStyle]="endStyle"></div>
      <div class="spl-range-slider__line-ghost"></div>
    </div>

  `
})
export class SplRangeSliderComponent
  implements ControlValueAccessor, AfterViewInit, OnDestroy {
  @Input()
  min = 0;

  @Input()
  max = 100;

  @Input()
  step = 1;

  @Input()
  minRange = 0;

  @Input()
  get value(): RangeValue {
    return this._value;
  }

  set value(value: RangeValue) {
    if (value !== this._value) {
      this._value = value;
      this.cdRef.markForCheck();
    }
  }

  @Output()
  readonly changed = new EventEmitter<RangeValue>();

  @Output()
  readonly slide = new EventEmitter<RangeValue>();

  @ViewChild('progress', { static: true })
  private progressRef: ElementRef | null = null;

  isMoving = false;
  isStartBullet = false;

  private _value: RangeValue = { start: this.min, end: this.max };
  private pxPerUnit = 0;
  private progressDimensions: DOMRect | null = null;
  private valueOnStart: RangeValue | null = null;
  private destroy: Subject<null> = new Subject<null>();

  // private bulletSize = 20;

  constructor(
    private cdRef: ChangeDetectorRef,
    @Inject(DOCUMENT) public document: Document
  ) {}

  /**
   * Get max value of two min numbers.
   */
  static maxValue(value: number, min = 0, max = 1): number {
    return Math.max(min, Math.min(value, max));
  }

  ngAfterViewInit(): void {
    this.setProgressDimension();
  }

  ngOnDestroy(): void {
    this.destroy.next(null);
    this.destroy.complete();
  }

  /********************* Event handlers *********************/

  /**
   * onTouch function registered via registerOnTouch (ControlValueAccessor).
   * is called when range slider has been touched.
   */
  onTouched: () => any = () => {};

  /**
   * onChangeFn function registered via registerOnTouch (ControlValueAccessor).
   * is called when value changes.
   */
  onChangeFn: (value: RangeValue) => void = () => {};

  @HostListener('document:mousemove', ['$event'])
  @HostListener('document:pointermove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.isMoving) {
      return;
    }

    const oldValue = { ...this.value } as RangeValue;
    this.updateValue(event.clientX);

    // if value didn't change, do nothing.
    if (this.isValueChanged(oldValue)) {
      this.slide.emit(this.value);
    }
    this.cdRef.detectChanges();
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: AppTouchEvent): void {
    if (!this.isMoving) {
      return;
    }

    const oldValue = { ...this.value } as RangeValue;
    this.updateValue(event.touches[0].clientX);

    // if value didn't change, do nothing.
    if (this.isValueChanged(oldValue)) {
      this.slide.emit(this.value);
    }
  }

  @HostListener('document:touchend')
  @HostListener('document:mouseup')
  onDraggingEnd(): void {
    if (!this.isMoving) {
      return;
    }

    // reset values.
    this.isMoving = false;
    this.isStartBullet = false;

    // if value didn't changed, do nothing.
    if (this.valueOnStart && this.isValueChanged(this.valueOnStart)) {
      this.emitChangeEvent();
    }
  }

  onDraggingStart(event: Event, isStartHandler: boolean): void {
    event.stopPropagation();
    this.setProgressDimension();
    this.isMoving = true;
    this.isStartBullet = isStartHandler;
    this.valueOnStart = { ...this.value } as RangeValue;
  }

  onRangeClick(event: MouseEvent) {
    if (!this.progressDimensions) {
      return;
    }

    const offset = this.progressDimensions.left;
    const size = this.progressDimensions.width;

    // Every click below 50% of progress bar size will update value for start bullet,
    // otherwise end bullet will be updated.
    this.isStartBullet = event.clientX - offset < size / 2;

    this.updateValue(event.clientX);
    this.slide.emit(this.value);
    this.emitChangeEvent();

    if (!this.isMoving) {
      this.setProgressDimension();
    }
  }

  onRangeTouch(event: TouchEvent) {
    if (!this.progressDimensions) {
      return;
    }

    const offset = this.progressDimensions.left;
    const size = this.progressDimensions.width;

    // Every click below 50% of progress bar size will update value for start bullet,
    // otherwise end bullet will be updated.
    this.isStartBullet = event.touches[0].clientX - offset < size / 2;

    this.updateValue(event.touches[0].clientX);
    this.slide.emit(this.value);
    this.emitChangeEvent();

    if (!this.isMoving) {
      this.setProgressDimension();
    }
  }

  /********************* ControlValueAccessor *********************/

  writeValue(value: RangeValue): void {
    this.value = value ? ({ ...value } as RangeValue) : this.value;
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  /********************* Private members *********************/

  /**
   * Get the DOMRect of the time range element.
   */
  private getProgressDimensions(): DOMRect {
    return this.progressRef
      ? this.progressRef.nativeElement.getBoundingClientRect()
      : null;
  }

  /**
   * Set progressbar dimensions.
   */
  private setProgressDimension(): void {
    this.progressDimensions = this.getProgressDimensions();
    this.pxPerUnit = this.progressDimensions.width / (this.max - this.min);
    this.cdRef.detectChanges();
  }

  /**
   * Compare old and new value object.
   * @param   oldValue Previous time range value
   * @returns true if object is changed, otherwise false.
   */
  private isValueChanged(oldValue: RangeValue): boolean {
    return (
      oldValue.start !== this.value.start || oldValue.end !== this.value.end
    );
  }

  /**
   * Emit changed value.
   */
  private emitChangeEvent(): void {
    this.onChangeFn(this.value);
    this.changed.emit(this.value);
  }

  /**
   * Update start/end value by bullet position.
   * @param x Mouse clientX position.
   */
  private updateValue(x: number): void {
    if (!this.progressDimensions) {
      return;
    }

    const offset = this.progressDimensions.left;
    const size = this.progressDimensions.width;
    const percent = SplRangeSliderComponent.maxValue((x - offset) / size);

    if (this.isStartBullet) {
      this.updateStartValue(percent);
    } else {
      this.updateEndValue(percent);
    }
  }

  /**
   * Update start value by bullet position.
   */
  private updateStartValue(percent: number): void {
    if (percent === 0) {
      this.value.start = this.min;
    } else if (percent === 1) {
      this.value.start = this.value.end - this.minRange;
    } else if (this.value.start < this.value.end) {
      const value = this.calculateValue(percent);
      const roundedValue =
        Math.round((value - this.min) / this.step) * this.step + this.min;

      if (roundedValue <= this.value.end - this.minRange) {
        this.value.start = SplRangeSliderComponent.maxValue(
          roundedValue,
          this.min,
          this.max
        );
      }
    }
  }

  /**
   * Update end value by bullet position.
   */
  private updateEndValue(percent: number): void {
    if (percent === 0) {
      this.value.end = this.value.start + this.minRange;
    } else if (percent === 1) {
      this.value.end = this.max;
    } else if (this.value.end > this.value.start) {
      const value = this.calculateValue(percent);
      const roundedValue =
        Math.round((value - this.min) / this.step) * this.step + this.min;

      if (roundedValue >= this.value.start + this.minRange) {
        this.value.end = SplRangeSliderComponent.maxValue(
          roundedValue,
          this.min,
          this.max
        );
      }
    }
  }

  private calculateValue(percentage: number): number {
    return this.min + percentage * (this.max - this.min);
  }

  /**
   * Get value transformed to pixel
   */
  private calculatePixelValue(value: number): number {
    return (value - this.min) * this.pxPerUnit;
  }

  /********************* CSS Styles *********************/

  /**
   * Set start bullet position.
   */
  get startStyle(): { [key: string]: string } {
    const value = this.calculatePixelValue(this.value.start); // + (this.bulletSize / 2); // start from middle

    return {
      transform: `translateX(${value}px)`
    };
  }

  /**
   * Set end bullet position.
   */
  get endStyle(): { [key: string]: string } {
    let value = 0;
    if (this.progressDimensions) {
      value =
        this.progressDimensions.width -
        this.calculatePixelValue(this.value.end); // + (this.bulletSize / 2); // start from middle
    }

    return {
      transform: `translateX(-${value}px)`
    };
  }

  /**
   * Set progress bar position and size.
   */
  get progressStyle(): { [key: string]: string } {
    if (!this.progressDimensions) {
      return {};
    }

    const endPosition =
      this.progressDimensions.width - this.calculatePixelValue(this.value.end);
    const translateX =
      (this.calculatePixelValue(this.value.start) - endPosition) / 2;
    const scaleX = (this.value.start - this.value.end) / (this.max - this.min);

    return {
      transform: `translateX(${translateX}px) scaleX(${scaleX})`
    };
  }
}
