export type PocSource = "google_wallet" | "nubank" | "whatsapp" | "simulator";
export type PocOrigin = "simulated" | "real";
export type PocRecordStatus = "accepted" | "duplicate" | "ignored";
export type PocSyncStatus = "local" | "syncing" | "synced" | "failed";

export interface PocSettings {
  captureEnabled: boolean;
  testMode: boolean;
  monitoredSources: PocSource[];
}

export interface PocTransaction {
  id: string;
  origin: PocOrigin;
  source: PocSource;
  sourcePackage: string;
  amountCents: number;
  merchant: string;
  cardLastFour?: string;
  occurredAt: string;
  receivedAt: string;
  status: PocRecordStatus;
  duplicateOf?: string;
  duplicateCount: number;
  syncStatus?: PocSyncStatus;
  syncError?: string;
  remoteEventId?: number;
  remoteOutgoingId?: number;
  remotelyDeduplicated?: boolean;
  rawTitle: string;
  rawText: string;
}

export interface NativeNotificationEvent {
  id: string;
  packageName: string;
  title: string;
  text: string;
  postedAt: number;
  simulated: boolean;
}
