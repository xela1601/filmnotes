import { Alert, Platform } from "react-native";

/**
 * Asks for confirmation of a destructive action.
 *
 * `Alert` is not implemented in react-native-web, so the browser falls back to
 * `window.confirm`.
 */
export function confirmDestructive(options: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
}): void {
  const { title, message, confirmLabel, cancelLabel, onConfirm } = options;

  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${title}\n\n${message}`) === true) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
