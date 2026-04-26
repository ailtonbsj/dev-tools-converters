import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

type NavigationItem = {
  label: string;
  icon: string;
  route: string;
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatListModule,
    MatSidenavModule,
    MatSlideToggleModule,
    MatToolbarModule
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  protected readonly navItems: NavigationItem[] = [
    { label: 'Início', icon: 'home', route: '/home' },
    { label: 'DDL para Java', icon: 'coffee', route: '/ddl-to-java' },
    { label: 'DDL para JPA Codex', icon: 'robot', route: '/ddl-to-jpa-bot' }
  ];
  private readonly breakpointObserver = inject(BreakpointObserver);

  private readonly mobileQuery = toSignal(
    this.breakpointObserver.observe('(max-width: 900px)').pipe(map((state) => state.matches)),
    { initialValue: false }
  );

  protected readonly isDarkMode = signal(this.readThemePreference());
  protected readonly isSidenavOpen = signal(true);
  protected readonly sidenavMode = computed(() => (this.mobileQuery() ? 'over' : 'side'));
  protected readonly sidenavOpened = computed(() => (this.mobileQuery() ? this.isSidenavOpen() : this.isSidenavOpen()));

  constructor() {
    this.applyTheme(this.isDarkMode());
    effect(() => {
      this.isSidenavOpen.set(!this.mobileQuery());
    });
  }

  protected isMobile(): boolean {
    return this.mobileQuery();
  }

  protected toggleSidenav(): void {
    this.isSidenavOpen.update((value) => !value);
  }

  protected toggleTheme(): void {
    const nextValue = !this.isDarkMode();
    this.isDarkMode.set(nextValue);
    this.applyTheme(nextValue);
  }

  private readThemePreference(): boolean {
    return localStorage.getItem('dev-tools-theme') === 'dark';
  }

  private applyTheme(isDarkMode: boolean): void {
    document.body.classList.toggle('dark-theme', isDarkMode);
    localStorage.setItem('dev-tools-theme', isDarkMode ? 'dark' : 'light');
  }
}
