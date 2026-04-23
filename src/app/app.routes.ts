import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home'
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home.component').then((m) => m.HomeComponent)
      },
      {
        path: 'ddl-to-jpa',
        loadComponent: () =>
          import('./features/ddl-to-jpa/ddl-to-jpa.component').then((m) => m.DdlToJpaComponent)
      },
      {
        path: 'ddl-to-jpa-bot',
        loadComponent: () =>
          import('./features/ddl-to-jpa-bot/ddl-to-jpa.component').then((m) => m.DdlToJpaComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
