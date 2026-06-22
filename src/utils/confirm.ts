/**
 * App-wide dialog system — a single themed in-app dialog that works identically
 * on web and native (no ugly browser `window.confirm` / `Alert` system popups).
 *
 * `confirm()` / `notify()` are imperative and can be called from anywhere
 * (components, thunks, services). They drive a `<ConfirmHost />` mounted once at
 * the app root via the listener registered below.
 */

export interface DialogRequest {
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  mode: 'confirm' | 'alert';
  resolve: (value: boolean) => void;
}

type Listener = (request: DialogRequest | null) => void;

let listener: Listener | null = null;

/** Registered by <ConfirmHost />. Internal use only. */
export const _setDialogListener = (l: Listener | null) => {
  listener = l;
};

const show = (req: Omit<DialogRequest, 'resolve'>): Promise<boolean> =>
  new Promise((resolve) => {
    if (!listener) {
      // No host mounted (should not happen): don't block destructive actions.
      resolve(req.mode === 'alert');
      return;
    }
    listener({ ...req, resolve });
  });

export const confirm = (
  title: string,
  message?: string,
  options: { confirmText?: string; cancelText?: string; destructive?: boolean } = {}
): Promise<boolean> =>
  show({
    title,
    message,
    mode: 'confirm',
    confirmText: options.confirmText ?? 'OK',
    cancelText: options.cancelText ?? 'Cancel',
    destructive: options.destructive ?? false,
  });

export const notify = (title: string, message?: string): Promise<void> =>
  show({ title, message, mode: 'alert', confirmText: 'OK', cancelText: '', destructive: false }).then(
    () => undefined
  );
