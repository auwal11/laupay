import { useEffect, useState } from "react";
import { Card } from "@app/components/ui/Card";
import { Button } from "@app/components/ui/Button";
import { Skeleton } from "@app/components/ui/Skeleton";
import { PinPad } from "@app/components/security/PinPad";
import { formatDateTime } from "@app/lib/format";
import { security } from "@app/services";
import type { DeviceInfo, PinStatusResponse, SecurityNotification } from "@app/types/security";

export function SecurityPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-8">
      <h1 className="font-display text-xl font-semibold text-laupay-ink">Security</h1>
      <PinSection />
      <DevicesSection />
      <NotificationsSection />
    </div>
  );
}

function PinSection() {
  const [status, setStatus] = useState<PinStatusResponse | null>(null);
  const [mode, setMode] = useState<"idle" | "create" | "change_current" | "change_new">("idle");
  const [currentPin, setCurrentPin] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    security.getPinStatus().then((result) => {
      if (result.ok) setStatus(result.data);
    });
  }, []);

  async function handleCreate(pin: string) {
    const result = await security.createPin(pin);
    if (result.ok) {
      setStatus({ hasPin: true, locked: false, lockedUntil: null });
      setMode("idle");
      setMessage("Transaction PIN set.");
    } else {
      setError(result.error.message);
    }
  }

  function handleCurrentPinEntered(pin: string) {
    setCurrentPin(pin);
    setMode("change_new");
  }

  async function handleNewPinEntered(newPin: string) {
    if (!currentPin) return;
    const result = await security.changePin(currentPin, newPin);
    if (result.ok) {
      setStatus({ hasPin: true, locked: false, lockedUntil: null });
      setMode("idle");
      setCurrentPin(null);
      setMessage("Transaction PIN changed.");
    } else {
      setError(result.error.message);
      setMode("idle");
      setCurrentPin(null);
    }
  }

  function cancel() {
    setMode("idle");
    setCurrentPin(null);
    setError(null);
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-laupay-ink">Transaction PIN</h2>
        {status && (
          <span className="text-xs font-medium text-laupay-ink-muted">
            {status.locked ? "Locked" : status.hasPin ? "Active" : "Not set"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-laupay-ink-muted">
        Separate from your password — required to authorize sensitive transactions.
      </p>

      {message && <p className="mt-3 text-sm text-laupay-success">{message}</p>}
      {error && <p className="mt-3 text-sm text-laupay-danger">{error}</p>}

      {mode === "idle" && status && (
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => setMode(status.hasPin ? "change_current" : "create")}
        >
          {status.hasPin ? "Change PIN" : "Set PIN"}
        </Button>
      )}

      {mode === "create" && (
        <div className="mt-4">
          <PinPad label="Choose a 4-digit PIN" onComplete={handleCreate} />
          <CancelLink onClick={cancel} />
        </div>
      )}

      {mode === "change_current" && (
        <div className="mt-4">
          <PinPad label="Enter your current PIN" onComplete={handleCurrentPinEntered} />
          <CancelLink onClick={cancel} />
        </div>
      )}

      {mode === "change_new" && (
        <div className="mt-4">
          <PinPad label="Choose your new PIN" onComplete={handleNewPinEntered} />
          <CancelLink onClick={cancel} />
        </div>
      )}
    </Card>
  );
}

function CancelLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 w-full text-center text-sm font-medium text-laupay-ink-muted hover:text-laupay-ink"
    >
      Cancel
    </button>
  );
}

function DevicesSection() {
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);

  useEffect(() => {
    security.getDevices().then((result) => {
      if (result.ok) setDevices(result.data);
    });
  }, []);

  async function handleRevoke(deviceId: string) {
    await security.revokeDevice(deviceId);
    setDevices((prev) => (prev ? prev.filter((d) => d.id !== deviceId) : prev));
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-laupay-ink">Trusted devices</h2>
      <p className="mt-1 text-sm text-laupay-ink-muted">
        Devices that have signed in to your account. Remove any you don't recognize.
      </p>

      {devices === null ? (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-laupay-border">
          {devices.map((device) => (
            <li key={device.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-laupay-ink">
                  {device.label} {device.isCurrent && <span className="text-laupay-indigo">· This device</span>}
                </p>
                <p className="text-xs text-laupay-ink-muted">
                  Last active {formatDateTime(device.lastActiveAt)}
                </p>
              </div>
              {!device.isCurrent && (
                <button
                  onClick={() => handleRevoke(device.id)}
                  className="text-sm font-medium text-laupay-danger hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NotificationsSection() {
  const [notifications, setNotifications] = useState<SecurityNotification[] | null>(null);

  useEffect(() => {
    security.getNotifications().then((result) => {
      if (result.ok) setNotifications(result.data);
    });
  }, []);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-laupay-ink">Security notifications</h2>

      {notifications === null ? (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : notifications.length === 0 ? (
        <p className="mt-3 text-sm text-laupay-ink-muted">No security notifications yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-laupay-border">
          {notifications.map((n) => (
            <li key={n.id} className="py-3">
              <p className={"text-sm " + (n.read ? "text-laupay-ink-muted" : "font-medium text-laupay-ink")}>
                {n.message}
              </p>
              <p className="text-xs text-laupay-ink-muted">{formatDateTime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
