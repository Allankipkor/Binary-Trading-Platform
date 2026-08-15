export {};

declare global {
  interface AndroidMessagesBridgeInterface {
    showNativeNotification: (title: string, body: string) => void;
  }

  interface Window {
    AndroidMessagesBridge?: AndroidMessagesBridgeInterface;
  }
}
