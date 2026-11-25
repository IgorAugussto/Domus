export {};

declare global {
  interface Window {
    domusDesktop?: {
      isElectron: boolean;
      platform: string;
      sessionStorage?: {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<void>;
        remove: (key: string) => Promise<void>;
      };
    };
  }
}
