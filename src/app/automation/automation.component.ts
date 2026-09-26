import { Component, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-automation',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './automation.component.html',
  styleUrl: './automation.component.css'
})
export class AutomationComponent {

  private readonly firestore = inject(Firestore);

  loading = false;
  message = '';

  automationEnabled = true;

  postsPerWeek = 3;

  postingTime = '14:30';

  postingDays: string[] = [
    'monday',
    'wednesday',
    'friday'
  ];

  autoGenerateContent = true;
  autoGenerateImage = true;
  autoSchedule = true;
  autoPublish = true;

  readonly days = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' }
  ];

  constructor() {
    this.loadSettings();
  }

  async loadSettings() {
    try {
      const ref = doc(
        this.firestore,
        'automation_settings',
        'instagram'
      );

      const snapshot = await getDoc(ref);

      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.data();

      this.automationEnabled =
        data['automationEnabled'] ?? true;

      this.postsPerWeek =
        data['postsPerWeek'] ?? 3;

      this.postingTime =
        data['postingTime'] ?? '14:30';

      this.postingDays =
        data['postingDays'] ?? [
          'monday',
          'wednesday',
          'friday'
        ];

      this.autoGenerateContent =
        data['autoGenerateContent'] ?? true;

      this.autoGenerateImage =
        data['autoGenerateImage'] ?? true;

      this.autoSchedule =
        data['autoSchedule'] ?? true;

      this.autoPublish =
        data['autoPublish'] ?? true;

    } catch (error) {
      console.error('Failed to load automation settings:', error);

      this.message =
        'Unable to load automation settings.';
    }
  }

  toggleDay(day: string) {

    if (this.postingDays.includes(day)) {

      this.postingDays =
        this.postingDays.filter(d => d !== day);

    } else {

      this.postingDays = [
        ...this.postingDays,
        day
      ];

    }
  }

  isDaySelected(day: string): boolean {
    return this.postingDays.includes(day);
  }

  async saveSettings() {

    if (!this.postingDays.length) {
      this.message =
        'Please select at least one posting day.';
      return;
    }

    if (
      this.postsPerWeek < 1 ||
      this.postsPerWeek > 7
    ) {
      this.message =
        'Posts per week must be between 1 and 7.';
      return;
    }

    this.loading = true;
    this.message = '';

    try {

      const ref = doc(
        this.firestore,
        'automation_settings',
        'instagram'
      );

      await setDoc(ref, {

        automationEnabled:
          this.automationEnabled,

        postsPerWeek:
          this.postsPerWeek,

        postingDays:
          this.postingDays,

        postingTime:
          this.postingTime,

        timezone:
          'Asia/Kolkata',

        autoGenerateContent:
          this.autoGenerateContent,

        autoGenerateImage:
          this.autoGenerateImage,

        autoSchedule:
          this.autoSchedule,

        autoPublish:
          this.autoPublish,

        updatedAt:
          new Date()

      }, { merge: true });

      this.message =
        'Automation settings saved successfully.';

    } catch (error: any) {

      console.error(
        'Failed to save automation settings:',
        error
      );

      this.message =
        error?.message ??
        'Failed to save automation settings.';

    } finally {

      this.loading = false;

    }
  }
}