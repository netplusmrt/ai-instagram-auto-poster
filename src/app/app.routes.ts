import { Routes } from '@angular/router';

import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './login/login.component';
import { ContentCalendarComponent } from './content-calendar/content-calendar.component';
import { InstagramComponent } from './instagram/instagram.component';
import { AutomationComponent } from './automation/automation.component';
import { SettingsComponent } from './settings/settings.component';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';

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
    path: '',
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [authGuard]
      },
      {
        path: '',
        component: AppLayoutComponent,
        canActivate: [authGuard],
        children: [
      { path: 'content-calendar', component: ContentCalendarComponent },
      { path: 'instagram', component: InstagramComponent },
      { path: 'automation', component: AutomationComponent },
      { path: 'settings', component: SettingsComponent }
        ]
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'dashboard'
  }
];