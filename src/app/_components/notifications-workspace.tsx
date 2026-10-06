"use client";
import { useState } from "react";
import { api } from "~/trpc/react";
import { Heading, Panel, Field, Empty, QueryState, Badge, useTask } from "./ui";
import { GuardianEmailReview } from "./guardian-email-review";

export function NotificationsWorkspace({ role }: { role: string }) {
  const admin = role === "admin";
  const inbox = api.notification.list.useQuery();
  const history = api.notification.smsHistory.useQuery(undefined, {
    enabled: admin,
  });
  const status = api.notification.integrationStatus.useQuery(undefined, {
    enabled: admin,
  });
  const people = api.admin.listUsers.useQuery(undefined, { enabled: admin });
  const compose = api.notification.compose.useMutation();
  const send = api.notification.sendSms.useMutation();
  const cancel = api.notification.cancelSms.useMutation();
  const refresh = api.notification.refreshSms.useMutation();
  const read = api.notification.markRead.useMutation();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const task = useTask();
  const students =
    people.data?.filter((p) => p.role === "student" && p.isActive) ?? [];
  return (
    <>
      <Heading
        title="Notifications"
        description={
          admin
            ? "Prepare school messages and review guardian emails before sending."
            : "Your attendance alerts and school messages."
        }
      />
      {task.feedback}
      {admin && (
        <>
          <Panel title="Connections">
            <QueryState loading={status.isLoading} error={status.error} />
            <div className="actions">
              <Badge>
                Google login:{" "}
                {status.data?.google ? "configured" : "not configured"}
              </Badge>
              <Badge>
                Guardian email:{" "}
                {status.data?.email ? "configured" : "not configured"}
              </Badge>
            </div>
            <p className="muted mt-4">
              Emails stay in the review queue until you send them. Add a
              guardian email and record email consent in People. Students also
              receive an in-app notification.
            </p>
            {status.data?.emailTestMode && (
              <p className="notice mt-4">
                Resend test mode: only your Resend account email can receive
                messages. To email other guardians, verify a sender domain in
                Resend.
              </p>
            )}
          </Panel>
          <Panel title="Prepare a school message">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void task.run(async () => {
                  const result = await compose.mutateAsync({
                    studentIds: selected,
                    message,
                  });
                  setMessage("");
                  setSelected([]);
                  return result;
                }, "Student notifications created. Eligible guardian emails are in the review queue.");
              }}
            >
              <Field label="Message">
                <textarea
                  required
                  maxLength={1000}
                  placeholder="EduTrack: Please be reminded..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>
              <fieldset className="mt-5">
                <legend className="font-semibold">Recipients</legend>
                <QueryState loading={people.isLoading} error={people.error} />
                <button
                  type="button"
                  className="btn secondary my-3"
                  onClick={() =>
                    setSelected(
                      selected.length === students.length
                        ? []
                        : students.map((s) => s.id),
                    )
                  }
                >
                  {selected.length === students.length
                    ? "Clear selection"
                    : "Select all students"}
                </button>
                <div className="form-grid max-h-64 overflow-y-auto">
                  {students.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(s.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, s.id]
                              : selected.filter((id) => id !== s.id),
                          )
                        }
                      />
                      <span>
                        {s.name}
                        <small className="block">
                          {s.guardianEmail && s.guardianEmailConsent
                            ? "Inbox + guardian email"
                            : "Inbox only"}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                className="btn mt-5"
                disabled={task.busy || !selected.length}
              >
                Prepare notifications ({selected.length})
              </button>
            </form>
          </Panel>
          <GuardianEmailReview configured={!!status.data?.email} />
          {(!!status.data?.twilio || !!history.data?.length) && (
            <Panel title="SMS review & delivery history">
              <QueryState loading={history.isLoading} error={history.error} />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Recipient</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data?.map((s) => (
                      <tr key={s.id}>
                        <td>
                          {s.to}
                          <small className="block">
                            {new Date(s.createdAt).toLocaleString()}
                          </small>
                        </td>
                        <td className="max-w-md min-w-64 whitespace-pre-wrap">
                          {s.message}
                          {s.error && <p className="notice error">{s.error}</p>}
                        </td>
                        <td>
                          <Badge>{s.status}</Badge>
                        </td>
                        <td>
                          <div className="actions">
                            {["pending", "failed"].includes(s.status) && (
                              <>
                                <button
                                  className="btn"
                                  disabled={task.busy || !status.data?.twilio}
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Send this SMS to ${s.to}? Twilio messaging charges may apply.`,
                                      )
                                    )
                                      void task.run(async () => {
                                        const result = await send.mutateAsync({
                                          id: s.id,
                                        });
                                        if (
                                          ["failed", "unknown"].includes(
                                            result.status,
                                          )
                                        )
                                          throw new Error(
                                            "SMS was not confirmed. Review its status before attempting another send.",
                                          );
                                      }, "Message submitted to Twilio. Refresh its status to check delivery.");
                                  }}
                                >
                                  Send SMS
                                </button>
                                <button
                                  className="btn secondary"
                                  disabled={task.busy}
                                  onClick={() =>
                                    void task.run(
                                      () => cancel.mutateAsync({ id: s.id }),
                                      "SMS cancelled.",
                                    )
                                  }
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {s.sid && (
                              <button
                                className="btn secondary"
                                disabled={task.busy}
                                onClick={() =>
                                  void task.run(
                                    () => refresh.mutateAsync({ id: s.id }),
                                    "Delivery status refreshed.",
                                  )
                                }
                              >
                                Refresh status
                              </button>
                            )}
                            {s.status === "unknown" && (
                              <small>
                                Check the Twilio console before sending again.
                              </small>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!history.data?.length && (
                <Empty>No guardian messages have been prepared yet.</Empty>
              )}
            </Panel>
          )}
        </>
      )}
      <Panel title={admin ? "School notification history" : "My inbox"}>
        <QueryState loading={inbox.isLoading} error={inbox.error} />
        {inbox.data?.map((n) => (
          <article key={n.id} className="announcement">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <small>{new Date(n.createdAt).toLocaleString()}</small>
              {!admin && !n.readAt && (
                <button
                  disabled={task.busy}
                  className="btn secondary"
                  onClick={() =>
                    void task.run(
                      () => read.mutateAsync({ id: n.id }),
                      "Marked as read.",
                    )
                  }
                >
                  Mark as read
                </button>
              )}
            </div>
            <p className="mt-3">{n.message}</p>
            {!admin && <small>{n.readAt ? "Read" : "Unread"}</small>}
          </article>
        ))}
        {!inbox.data?.length && (
          <Empty>Your notifications will appear here.</Empty>
        )}
      </Panel>
    </>
  );
}
