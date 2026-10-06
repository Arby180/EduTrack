"use client";
import { useState } from "react";
import { api, type RouterInputs } from "~/trpc/react";
import { Heading, Panel, Field, QueryState, Empty, useTask } from "./ui";
export function Classes() {
  const classes = api.admin.listClasses.useQuery();
  const subjects = api.admin.listSubjects.useQuery();
  const saveClass = api.admin.saveClass.useMutation();
  const saveSubject = api.admin.saveSubject.useMutation();
  const deleteClass = api.admin.deleteClass.useMutation();
  const deleteSubject = api.admin.deleteSubject.useMutation();
  const task = useTask();
  const blank = { name: "", gradeLevel: "", schoolYear: "" };
  const [form, setForm] = useState<RouterInputs["admin"]["saveClass"]>(blank);
  const [subject, setSubject] = useState<RouterInputs["admin"]["saveSubject"]>({
    name: "",
    classRoomId: 0,
  });
  return (
    <>
      <Heading
        title="Classes & subjects"
        description="Organize your school before recording attendance and grades."
      />
      {task.feedback}
      <div className="chart-grid">
        <Panel title={form.id ? "Edit class" : "Add a class"}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await saveClass.mutateAsync(form);
                setForm(blank);
              });
            }}
          >
            <div className="form-grid">
              <Field label="Class / section">
                <input
                  required
                  placeholder="e.g. 3A"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Grade level">
                <input
                  value={form.gradeLevel}
                  onChange={(e) =>
                    setForm({ ...form, gradeLevel: e.target.value })
                  }
                />
              </Field>
              <Field label="School year">
                <input
                  placeholder="2026-2027"
                  value={form.schoolYear}
                  onChange={(e) =>
                    setForm({ ...form, schoolYear: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="actions mt-5">
              <button className="btn" disabled={task.busy}>
                Save class
              </button>
              {form.id && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setForm(blank)}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </Panel>
        <Panel title={subject.id ? "Edit subject" : "Add a subject"}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await saveSubject.mutateAsync(subject);
                setSubject({ name: "", classRoomId: 0 });
              });
            }}
          >
            <Field label="Subject name">
              <input
                required
                value={subject.name}
                onChange={(e) =>
                  setSubject({ ...subject, name: e.target.value })
                }
              />
            </Field>
            <div className="mt-4">
              <Field label="Class">
                <select
                  required
                  disabled={!!subject.id}
                  value={subject.classRoomId || ""}
                  onChange={(e) =>
                    setSubject({
                      ...subject,
                      classRoomId: Number(e.target.value),
                    })
                  }
                >
                  <option value="">Select class</option>
                  {classes.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="actions mt-5">
              <button className="btn" disabled={task.busy}>
                Save subject
              </button>
              {subject.id && (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setSubject({ name: "", classRoomId: 0 })}
                >
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </Panel>
      </div>
      <QueryState
        loading={classes.isLoading || subjects.isLoading}
        error={classes.error ?? subjects.error}
      />
      <Panel title="Class directory">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Grade level</th>
                <th>School year</th>
                <th>Subjects</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.data?.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{c.gradeLevel?.trim() ? c.gradeLevel : "-"}</td>
                  <td>{c.schoolYear?.trim() ? c.schoolYear : "-"}</td>
                  <td>
                    {subjects.data
                      ?.filter((s) => s.classRoomId === c.id)
                      .map((s) => s.name)
                      .join(", ") ?? "No subjects"}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn secondary"
                        onClick={() => {
                          setForm({
                            id: c.id,
                            name: c.name,
                            gradeLevel: c.gradeLevel ?? "",
                            schoolYear: c.schoolYear ?? "",
                          });
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn danger"
                        disabled={task.busy}
                        onClick={() => {
                          if (confirm(`Delete class ${c.name}?`))
                            void task.run(
                              () => deleteClass.mutateAsync({ id: c.id }),
                              "Class deleted.",
                            );
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!classes.data?.length && <Empty>Add your first class above.</Empty>}
      </Panel>
      <Panel title="Subject directory">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Class</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.data?.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    {classes.data?.find((c) => c.id === s.classRoomId)?.name}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn secondary"
                        onClick={() => {
                          setSubject(s);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn danger"
                        disabled={task.busy}
                        onClick={() => {
                          if (confirm(`Delete subject ${s.name}?`))
                            void task.run(
                              () => deleteSubject.mutateAsync({ id: s.id }),
                              "Subject deleted.",
                            );
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!subjects.data?.length && <Empty>No subjects yet.</Empty>}
      </Panel>
    </>
  );
}
