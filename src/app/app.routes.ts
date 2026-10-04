import { Routes } from '@angular/router';

import { signedInGuard } from './core/auth.guard';

// Every screen is lazy-loaded. Case screens need a session (anonymous sign-in is enough).
export const routes: Routes = [
  {
    path: 'saved-runs',
    title: 'Saved runs · Nivaran AI',
    loadComponent: () => import('./features/samples/saved-runs').then((m) => m.SavedRuns),
  },
  {
    path: 'samples/:sampleId',
    title: 'Saved run · Nivaran AI',
    loadComponent: () => import('./features/samples/saved-sample').then(m => m.SavedSampleView),
  },
  {
    path: '',
    pathMatch: 'full',
    title: 'Nivaran AI',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'cases',
    canActivate: [signedInGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'My cases · Nivaran AI',
        loadComponent: () => import('./features/my-cases/my-cases').then((m) => m.MyCases),
      },
      {
        path: 'new',
        title: 'New case · Nivaran AI',
        loadComponent: () => import('./features/case-new/case-new').then((m) => m.CaseNew),
      },
      {
        path: ':caseId',
        title: 'Case · Nivaran AI',
        loadComponent: () => import('./features/case-workspace/case-workspace').then((m) => m.CaseWorkspace),
      },
      {
        path: ':caseId/pack',
        title: 'Complaint pack · Nivaran AI',
        loadComponent: () => import('./features/case-pack/case-pack').then((m) => m.CasePack),
      },
    ],
  },
  {
    // The case screen with invented sample data: no sign-in, no model calls.
    path: 'demo',
    title: 'Sample case · Nivaran AI',
    loadComponent: () => import('./features/demo/demo').then((m) => m.Demo),
  },
  {
    path: 'status',
    title: 'Status · Nivaran AI',
    loadComponent: () => import('./features/system-check/system-check').then((m) => m.SystemCheck),
  },
  { path: '**', redirectTo: '' },
];
