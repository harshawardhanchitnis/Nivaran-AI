import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('creates the app shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the product name, the main navigation and the standing disclaimer', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('.brand')?.textContent).toContain('Nivaran AI');
    expect(page.querySelector('nav[aria-label="Main"]')?.textContent).toContain('My cases');
    expect(page.querySelector('footer')?.textContent).toContain('not legal advice');
  });
});
