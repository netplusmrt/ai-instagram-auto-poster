import { Routes } from '@angular/router';

import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { ContentCalendarComponent } from './content-calendar/content-calendar.component';
import { InstagramComponent } from './instagram/instagram.component';
import { AutomationComponent } from './automation/automation.component';
import { SettingsComponent } from './settings/settings.component';

import { authGuard } from './services/auth-guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },

  {
    path: 'login',
    component: LoginComponent
  },

  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard]
  },

  {
    path: 'content-calendar',
    component: ContentCalendarComponent,
    canActivate: [authGuard]
  },

  {
    path: 'instagram',
    component: InstagramComponent,
    canActivate: [authGuard]
  },

  {
    path: 'automation',
    component: AutomationComponent,
    canActivate: [authGuard]
  },

  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [authGuard]
  },

  {
    path: '**',
    redirectTo: 'dashboard'
  }
];