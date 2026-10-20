import { useState } from "react";
import { Link } from "react-router-dom";
import { adminService } from "@app/admin/services";
import { LoadingRows, PageHeader, Pagination, StatusBadge, selectClass, useAsync } from "@app/admin/ui";
import { Card } from "@app/components/ui/Card";
import { EmptyState } from "@app/components/ui/EmptyState";
import { ErrorState } from "@app/components/ui/ErrorState";
import { formatDateTime, formatNaira } from "@app/lib/format";

export function AdminDisputesPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const state = useAsync(
    () => adminService.disputes({ status: status || undefined, page }),
    [status, page],
  );

  return (
    <div>
      <PageHeader
        title="Disputes"
        description="Customer transaction complaints, evidence and refund decisions."
        actions={
          <select
            aria-label="Filter disputes"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            <option value="">All cases</option>
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CLOSED">Closed</option>
          </select>
        }
      />
      {state.status === "loading" && <LoadingRows rows={6} />}
      {state.status === "error" && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.status === "success" &&
        (state.data.items.length === 0 ? (
          <EmptyState
            title="No disputes"
            description="Customer disputes will appear here after they are submitted."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {state.data.items.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/disputes/${item.id}`}
                        className="font-semibold text-laupay-indigo hover:underline"
                      >
                        {item.caseReference}
                      </Link>
                      <StatusBadge value={item.status} />
                    </div>
                    <p className="mt-2 text-sm text-laupay-ink">{item.reason.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xs text-laupay-ink-muted">
                      {item.userName} · {item.userEmail} · submitted {formatDateTime(item.createdAt)}
                    </p>
                    <p className="mt-2 break-words text-xs text-laupay-ink-muted">
                      {item.direction} · {formatNaira(item.amount)} · transaction{" "}
                      {formatDateTime(item.transactionCreatedAt)}
                    </p>
                  </div>
                  <Link
                    to={`/admin/disputes/${item.id}`}
                    className="shrink-0 text-xs font-medium text-laupay-indigo hover:underline"
                  >
                    Review case →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        ))}
      {state.status === "success" && (
        <Pagination
          page={state.data.page}
          pageSize={state.data.pageSize}
          total={state.data.total}
          onPage={setPage}
        />
      )}
    </div>
  );
}
