import { useCallback, useRef, useState } from 'react';

// Защита от повторного сабмита: пока действие выполняется, повторный вызов игнорируется.
// ref даёт синхронную блокировку (не ждёт ре-рендера), busy — для отключения кнопок в UI.
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const run = useCallback(async (fn: () => Promise<void> | void) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
