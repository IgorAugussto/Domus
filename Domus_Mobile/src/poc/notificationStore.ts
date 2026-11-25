import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PocSettings, PocTransaction } from "./notificationTypes";

const SETTINGS_KEY = "domus.poc.notification.settings.v1";
const RECORDS_KEY = "domus.poc.notification.records.v1";

export const DEFAULT_SETTINGS: PocSettings = {
  captureEnabled: false,
  testMode: false,
  monitoredSources: ["simulator"],
};

export async function loadPocSettings(): Promise<PocSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function savePocSettings(settings: PocSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadPocRecords(): Promise<PocTransaction[]> {
  const raw = await AsyncStorage.getItem(RECORDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PocTransaction[];
  } catch {
    return [];
  }
}

export async function savePocRecords(records: PocTransaction[]): Promise<void> {
  await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records.slice(0, 200)));
}

export async function clearPocRecords(): Promise<void> {
  await AsyncStorage.removeItem(RECORDS_KEY);
}
