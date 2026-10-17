export {};

declare global {
  interface AndroidMessagesBridgeInterface {
    showNativeNotification: (title: string, body: string) => void;
    setAppUser?: (userIdentifier: string) => void;
    onMessagesReceived?: (jsonString: string) => void;
  }

  interface Window {
    AndroidMessagesBridge?: AndroidMessagesBridgeInterface;
  }
}
