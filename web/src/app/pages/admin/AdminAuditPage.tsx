import { useState } from "react";
import type { FormEvent } from "react";
import { adminService } from "@app/admin/services";
import {
  LoadingRows,
  PageHeader,
  Pagination,
  StatusBadge,
  Td,
  Th,
  selectClass,
  useAsync,
} from "@app/admin/ui";
import { Button } from "@app/components/ui/Button";
import { Card } from "@app/components/ui/Card";
import { EmptyState } from "@app/components/ui/EmptyState";
import { ErrorState } from "@app/components/ui/ErrorState";
import { formatDateTime } from "@app/lib/format";

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGIN_FAILED",
  "ADMIN_ACTION",
  "WALLET_ADJUSTMENT",
];

export function AdminAuditPage() {
  const [action, setAction] = useState("");
  const [entityTypeInput, setEntityTypeInput] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);

  const state = useAsync(
    () =>
      adminService.audit({
        action: action || undefined,
        entityType: entityType || undefined,
        page,
      }),
    [action, entityType, page],
  );

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setEntityType(entityTypeInput.trim());
  };

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Security-relevant actions: logins, admin changes and wallet adjustments."
      />

      <form onSubmit={onSearch} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="audit-action" className="text-sm font-medium text-laupay-ink">
            Action
          </label>
          <select
            id="audit-action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[200px] flex-col gap-1.5">
          <label htmlFor="audit-entity" className="text-sm font-medium text-laupay-ink">
            Entity type
          </label>
          <input
            id="audit-entity"
            value={entityTypeInput}
            onChange={(e) => setEntityTypeInput(e.target.value)}
            placeholder="e.g. User, WalletAccount"
            className={selectClass}
          />
        </div>
        <Button type="submit">Filter</Button>
      </form>

      {state.status === "loading" && <LoadingRows />}
      {state.status === "error" && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.status === "success" && (
        <>
          {state.data.items.length === 0 ? (
            <EmptyState title="No audit entries" description="Try adjusting your filters." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Entity</Th>
                    <Th>Reason</Th>
                    <Th>IP</Th>
                    <Th>Change</Th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((entry) => (
                    <tr key={entry.id} className="border-b border-laupay-border last:border-0">
                      <Td className="whitespace-nowrap text-xs text-laupay-ink-muted">
                        {formatDateTime(entry.createdAt)}
                      </Td>
                      <Td className="text-xs">
                        {entry.actor ? (
                          <>
                            <span className="font-medium">{entry.actor.fullName}</span>
                            <span className="block text-laupay-ink-muted">{entry.actor.email}</span>
                          </>
                        ) : (
                          <span className="text-laupay-ink-muted">system</span>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge value={entry.action} />
                      </Td>
                      <Td className="text-xs">
                        {entry.entityType}
                        {entry.entityId && (
                          <span className="block font-mono text-[10px] text-laupay-ink-muted">
                            {entry.entityId}
                          </span>
                        )}
                      </Td>
                      <Td className="font-mono text-[11px] text-laupay-ink-muted">
                        {entry.ipAddress ?? "—"}
                        {entry.userAgent && (
                          <span className="block max-w-[140px] truncate text-[10px]">{entry.userAgent}</span>
                        )}
                      </Td>
                      <Td className="max-w-[200px] text-xs text-laupay-ink">
                        {entry.reason ?? <span className="text-laupay-ink-muted">—</span>}
                      </Td>
                      <Td className="max-w-[260px]">
                        {entry.before || entry.after ? (
                          <details>
                            <summary className="cursor-pointer text-[11px] font-medium text-laupay-indigo">
                              View change
                            </summary>
                            <pre className="mt-1 max-h-40 overflow-auto rounded bg-laupay-surface-muted p-2 text-[10px]">
                              {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="font-mono text-[11px] text-laupay-ink-muted">
                            {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                          </span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          <Pagination
            page={state.data.page}
            pageSize={state.data.pageSize}
            total={state.data.total}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}
