import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  inject
} from '@angular/core';

/**
 * Fades/slides an element in the first time it scrolls into view.
 * Stagger with [style.transition-delay] on repeated items.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: {
    class: 'reveal'
  }
})
export class Reveal implements AfterViewInit, OnDestroy {
  private element = inject(ElementRef<HTMLElement>);
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    if (
      typeof IntersectionObserver === 'undefined' ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      this.element.nativeElement.classList.add('revealed');
      return;
    }

    this.observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.element.nativeElement.classList.add('revealed');
          this.observer?.disconnect();
          this.observer = null;
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    this.observer.observe(this.element.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
