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
        path: 'ddl-to-module',
        loadComponent: () =>
          import('./features/ddl-to-module/ddl-to-module.component').then((m) => m.DdlToModuleComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'home'
  }
];
