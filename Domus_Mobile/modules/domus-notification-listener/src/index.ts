import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeNotificationEvent {
  id: string;
  packageName: string;
  title: string;
  text: string;
  postedAt: number;
  simulated: boolean;
}

interface DomusNotificationListenerModule {
  configure(captureEnabled: boolean, testMode: boolean, packages: string[]): void;
  isConfigured(): boolean;
  isNotificationAccessGranted(): boolean;
  openNotificationAccessSettings(): void;
  requestCaptureRefresh(): void;
  drainEvents(): NativeNotificationEvent[];
}

export default requireOptionalNativeModule<DomusNotificationListenerModule>('DomusNotificationListener');
