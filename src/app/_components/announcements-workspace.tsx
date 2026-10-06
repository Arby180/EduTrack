"use client";
import { useState } from "react";
import Link from "next/link";
import { api, type RouterInputs } from "~/trpc/react";
import { Heading, Panel, Field, Empty, QueryState, useTask } from "./ui";

export function AnnouncementsWorkspace({ role }: { role: string }) {
  const query = api.announcement.list.useQuery();
  const save = api.announcement.save.useMutation();
  const remove = api.announcement.remove.useMutation();
  const [form, setForm] = useState<RouterInputs["announcement"]["save"]>({
    title: "",
    body: "",
  });
  const [show, setShow] = useState(false);
  const task = useTask();
  return (
    <>
      <Heading
        title="Announcements"
        description="The latest updates from your school."
      >
        {role === "admin" && (
          <button
            className="btn"
            onClick={() => {
              setForm({ title: "", body: "" });
              setShow(true);
            }}
          >
            + New announcement
          </button>
        )}
      </Heading>
      {task.feedback}
      {show && (
        <Panel
          title={form.id ? "Edit announcement" : "Publish an announcement"}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await save.mutateAsync(form);
                setShow(false);
              }, "Announcement published.");
            }}
          >
            <Field label="Title">
              <input
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <div className="mt-4">
              <Field label="Message">
                <textarea
                  required
                  maxLength={10000}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                />
              </Field>
            </div>
            <div className="actions mt-5">
              <button className="btn" disabled={task.busy}>
                Publish announcement
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShow(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}
      <QueryState loading={query.isLoading} error={query.error} />
      {query.data?.map((a) => (
        <Panel key={a.id}>
          <article>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <small>{new Date(a.createdAt).toLocaleDateString()}</small>
              {role === "admin" && (
                <div className="actions">
                  <button
                    className="btn secondary"
                    onClick={() => {
                      setForm(a);
                      setShow(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn danger"
                    disabled={task.busy}
                    onClick={() => {
                      if (confirm("Delete this announcement?"))
                        void task.run(
                          () => remove.mutateAsync({ id: a.id }),
                          "Announcement deleted.",
                        );
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <h2 className="mt-4">{a.title}</h2>
            <p className="leading-7 whitespace-pre-wrap">{a.body}</p>
          </article>
        </Panel>
      ))}
      {!query.isLoading && !query.data?.length && (
        <Panel>
          <Empty>No announcements yet.</Empty>
        </Panel>
      )}
      {role === "admin" && (
        <p className="muted">
          To notify guardians by SMS,{" "}
          <Link href="/notifications" className="underline">
            prepare a message in Notifications
          </Link>
          .
        </p>
      )}
    </>
  );
}
