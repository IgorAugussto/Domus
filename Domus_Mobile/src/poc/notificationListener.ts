import { Platform } from "react-native";
import NativeModule, { type NativeNotificationEvent } from "../../modules/domus-notification-listener/src";
import type { PocSettings } from "./notificationTypes";

export const SOURCE_PACKAGES = {
  google_wallet: "com.google.android.apps.walletnfcrel",
  nubank: "com.nu.production",
  whatsapp: "com.whatsapp",
  simulator: "domus.simulator",
} as const;

export function nativeListenerAvailable(): boolean {
  return Platform.OS === "android" && Boolean(NativeModule);
}

export function configureNativeListener(settings: PocSettings): void {
  if (!NativeModule || !nativeListenerAvailable()) return;
  NativeModule.configure(
    settings.captureEnabled,
    settings.testMode,
    settings.monitoredSources.map((source) => SOURCE_PACKAGES[source]),
  );
}

export function requestCaptureRefresh(): void {
  if (NativeModule && nativeListenerAvailable()) NativeModule.requestCaptureRefresh();
}

export function openNotificationAccessSettings(): void {
  if (NativeModule && nativeListenerAvailable()) NativeModule.openNotificationAccessSettings();
}

export function hasNotificationAccess(): boolean {
  return Boolean(NativeModule && nativeListenerAvailable() && NativeModule.isNotificationAccessGranted());
}

export function drainNativeEvents(): NativeNotificationEvent[] {
  return NativeModule && nativeListenerAvailable() ? NativeModule.drainEvents() : [];
}
