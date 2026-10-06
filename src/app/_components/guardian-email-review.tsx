"use client";
import { api } from "~/trpc/react";
import { Badge, Empty, Panel, QueryState, useTask } from "./ui";

export function GuardianEmailReview({ configured }: { configured: boolean }) {
  const history = api.notification.emailHistory.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const send = api.notification.sendEmail.useMutation();
  const cancel = api.notification.cancelEmail.useMutation();
  const refresh = api.notification.refreshEmail.useMutation();
  const task = useTask();
  return (
    <Panel title="Guardian email review & delivery history">
      {task.feedback}
      <QueryState loading={history.isLoading} error={history.error} />
      <p className="muted mb-4">
        Review the recipient and message before sending. Accepted means Resend
        received the request; it does not confirm inbox delivery.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Guardian email</th>
              <th>Message</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.data?.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.toEmail}
                  <small className="block">
                    {new Date(item.createdAt).toLocaleString()}
                  </small>
                </td>
                <td className="max-w-md min-w-64 whitespace-pre-wrap">
                  {item.message}
                  {item.errorMessage && (
                    <p className="notice error">{item.errorMessage}</p>
                  )}
                </td>
                <td>
                  <Badge>{item.status.replace("provider:", "")}</Badge>
                </td>
                <td>
                  <div className="actions">
                    {["pending", "failed"].includes(item.status) && (
                      <>
                        <button
                          className="btn"
                          disabled={task.busy || !configured}
                          onClick={() => {
                            if (confirm(`Send this email to ${item.toEmail}?`))
                              void task.run(async () => {
                                const result = await send.mutateAsync({
                                  id: item.id,
                                });
                                if (result.status !== "accepted")
                                  throw new Error(
                                    "Email delivery was not confirmed. Review the status and provider logs before trying again.",
                                  );
                              }, "Email accepted by Resend. Refresh status to check delivery.");
                          }}
                        >
                          Send email
                        </button>
                        <button
                          className="btn secondary"
                          disabled={task.busy}
                          onClick={() =>
                            void task.run(
                              () => cancel.mutateAsync({ id: item.id }),
                              "Email cancelled.",
                            )
                          }
                        >
                          Cancel email
                        </button>
                      </>
                    )}
                    {item.providerId && (
                      <button
                        className="btn secondary"
                        disabled={task.busy || !configured}
                        onClick={() =>
                          void task.run(
                            () => refresh.mutateAsync({ id: item.id }),
                            "Email status refreshed.",
                          )
                        }
                      >
                        Refresh email status
                      </button>
                    )}
                    {["sending", "unknown"].includes(item.status) && (
                      <small>
                        Check Resend logs before preparing another email.
                      </small>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!history.isLoading && !history.data?.length && (
        <Empty>
          No guardian emails yet. Add an email and consent in People, then mark
          an absence or prepare a school message.
        </Empty>
      )}
    </Panel>
  );
}
