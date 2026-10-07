"use client";
import { useState } from "react";
import { DeleteAccountButton } from "./delete-account-button";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";
import { Heading, Panel, Field, QueryState, Empty, Badge, useTask } from "./ui";
type Form = RouterInputs["admin"]["saveUser"];
const blank: Form = {
  name: "",
  email: "",
  role: "student",
  password: "",
  studentNumber: "",
  classRoomId: null,
  gradeLevel: "",
  guardianName: "",
  guardianPhone: "",
  guardianSmsConsent: false,
  guardianEmail: "",
  guardianEmailConsent: false,
};
export function People() {
  const query = api.admin.listUsers.useQuery(undefined, {
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
  });
  const classes = api.admin.listClasses.useQuery();
  const save = api.admin.saveUser.useMutation();
  const active = api.admin.setActive.useMutation();
  const task = useTask();
  const [form, setForm] = useState<Form>(blank);
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");
  const [approvalHelp, setApprovalHelp] = useState(false);
  function edit(user: RouterOutputs["admin"]["listUsers"][number]) {
    setApprovalHelp(user.approvalPending);
    setForm({
      id: user.id,
      name: user.name ?? "",
      email: user.email,
      role: user.role,
      password: "",
      studentNumber: user.studentNumber?.startsWith("PENDING-")
        ? ""
        : (user.studentNumber ?? ""),
      classRoomId: user.classRoomId,
      gradeLevel: user.gradeLevel ?? "",
      guardianName: user.guardianName ?? "",
      guardianPhone: user.guardianPhone ?? "",
      guardianSmsConsent: user.guardianSmsConsent ?? false,
      guardianEmail: user.guardianEmail ?? "",
      guardianEmailConsent: user.guardianEmailConsent ?? false,
    });
    setShow(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const rows =
    query.data
      ?.filter((u) =>
        [u.name, u.email, u.studentNumber].some((v) =>
          v?.toLowerCase().includes(search.toLowerCase()),
        ),
      )
      .sort((a, b) => Number(b.approvalPending) - Number(a.approvalPending)) ??
    [];
  return (
    <>
      <Heading
        title="People"
        description="Manage student records, guardian contacts, and school access."
      >
        <button
          className="btn secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Refreshing..." : "Refresh accounts"}
        </button>
        <button
          className="btn"
          onClick={() => {
            setForm(blank);
            setApprovalHelp(false);
            setShow(true);
          }}
        >
          + Add account
        </button>
      </Heading>
      {task.feedback}
      {!!query.data?.some((u) => u.approvalPending) && (
        <p className="notice mb-5">
          {query.data?.filter((u) => u.approvalPending).length} Google
          registration(s) awaiting approval are listed first. Edit each student
          to assign their student number and class, then select Approve access.
        </p>
      )}
      {show && (
        <Panel title={form.id ? "Edit account" : "New account"}>
          {approvalHelp && (
            <p className="notice mb-5" role="status">
              Select the approved role. For students, assign a student number
              and class. Save, then select Approve access in the account list. A
              password is optional for Google sign-in.
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await save.mutateAsync(form);
                setShow(false);
              });
            }}
          >
            <div className="form-grid">
              <Field label="Full name">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Email address">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Role">
                <select
                  disabled={!!form.id && !approvalHelp}
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as "student" | "admin",
                    })
                  }
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field
                label={
                  form.id
                    ? "New password (leave blank to keep current)"
                    : "Initial password"
                }
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  required={!form.id}
                  minLength={8}
                  maxLength={128}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </Field>
              {form.role === "student" && (
                <>
                  <Field label="Student number">
                    <input
                      required
                      value={form.studentNumber}
                      onChange={(e) =>
                        setForm({ ...form, studentNumber: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Class">
                    <select
                      value={form.classRoomId ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          classRoomId: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {classes.data?.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Grade level">
                    <input
                      value={form.gradeLevel}
                      onChange={(e) =>
                        setForm({ ...form, gradeLevel: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Guardian name">
                    <input
                      value={form.guardianName}
                      onChange={(e) =>
                        setForm({ ...form, guardianName: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Guardian email (optional)">
                    <input
                      type="email"
                      value={form.guardianEmail}
                      onChange={(e) =>
                        setForm({ ...form, guardianEmail: e.target.value })
                      }
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.guardianEmailConsent}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          guardianEmailConsent: e.target.checked,
                        })
                      }
                    />
                    Guardian agrees to school email notifications
                  </label>
                  <Field label="Guardian phone (optional)">
                    <input
                      type="tel"
                      placeholder="09171234567 or +639171234567"
                      value={form.guardianPhone}
                      onChange={(e) =>
                        setForm({ ...form, guardianPhone: e.target.value })
                      }
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.guardianSmsConsent}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          guardianSmsConsent: e.target.checked,
                        })
                      }
                    />{" "}
                    Guardian agrees to school SMS notifications
                  </label>
                </>
              )}
            </div>
            <div className="actions mt-5">
              <button className="btn" disabled={task.busy}>
                {task.busy ? "Saving..." : "Save account"}
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
      <Panel>
        <div className="filters">
          <Field label="Search people">
            <input
              placeholder="Name, email, or student number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <span className="badge">{rows.length} accounts</span>
        </div>
        <QueryState loading={query.isLoading} error={query.error} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name / email</th>
                <th>Role</th>
                <th>Class</th>
                <th>Guardian</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <div className="muted mt-1">{u.email}</div>
                    <small>
                      {u.studentNumber?.startsWith("PENDING-")
                        ? "Student number unassigned"
                        : u.studentNumber}
                    </small>
                  </td>
                  <td>
                    <Badge>{u.role}</Badge>
                  </td>
                  <td>
                    {classes.data?.find((c) => c.id === u.classRoomId)?.name ??
                      "-"}
                  </td>
                  <td>
                    {u.guardianName ?? "-"}
                    <div className="muted">{u.guardianPhone}</div>
                    <div className="muted">{u.guardianEmail}</div>
                  </td>
                  <td>
                    {u.approvalPending
                      ? "Awaiting approval"
                      : u.isActive
                        ? "Active"
                        : "Inactive"}
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn secondary" onClick={() => edit(u)}>
                        Edit
                      </button>
                      <DeleteAccountButton
                        id={u.id}
                        name={u.name ?? u.email}
                        onDeleted={() => {
                          if (form.id === u.id) {
                            setShow(false);
                            setForm(blank);
                          }
                        }}
                      />
                      <button
                        className="btn secondary"
                        disabled={task.busy}
                        onClick={() => {
                          if (
                            u.approvalPending &&
                            u.role === "student" &&
                            (!u.classRoomId ||
                              !u.studentNumber ||
                              u.studentNumber.startsWith("PENDING-"))
                          ) {
                            edit(u);
                            return;
                          }
                          if (
                            window.confirm(
                              `${u.approvalPending ? "Approve access for" : u.isActive ? "Deactivate" : "Reactivate"} ${u.name}?`,
                            )
                          )
                            void task.run(() =>
                              active.mutateAsync({
                                id: u.id,
                                isActive: !u.isActive,
                              }),
                            );
                        }}
                      >
                        {u.approvalPending
                          ? "Approve access"
                          : u.isActive
                            ? "Deactivate"
                            : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.isLoading && !rows.length && (
          <Empty>No accounts match your search.</Empty>
        )}
      </Panel>
      <p className="muted text-xs">
        Deactivation blocks login while preserving academic records. To enable
        Google login, use the student&apos;s verified Google email.
      </p>
    </>
  );
}
