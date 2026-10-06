"use client";
import { useState } from "react";
import { api, type RouterInputs } from "~/trpc/react";
import { Heading, Panel, Field, Empty, QueryState, useTask } from "./ui";
type Form = RouterInputs["grade"]["save"];
const blank: Form = {
  studentId: "",
  subjectId: 0,
  type: "quiz",
  label: "",
  score: 0,
  total: 100,
  quarter: 1,
  remarks: "",
};
export function GradesWorkspace({
  role,
  userId,
}: {
  role: string;
  userId: string;
}) {
  const [studentId, setStudentId] = useState(role === "student" ? userId : "");
  const [quarter, setQuarter] = useState("");
  const [form, setForm] = useState<Form>(blank);
  const [show, setShow] = useState(false);
  const people = api.admin.listUsers.useQuery(undefined, {
    enabled: role === "admin",
  });
  const subjects = api.admin.listSubjects.useQuery(undefined, {
    enabled: role === "admin",
  });
  const query = api.grade.getGradesByStudent.useQuery(
    { studentId, ...(quarter ? { quarter: Number(quarter) } : {}) },
    { enabled: !!studentId },
  );
  const summary = api.grade.getGradeSummaryBySubject.useQuery(
    { studentId, ...(quarter ? { quarter: Number(quarter) } : {}) },
    { enabled: !!studentId },
  );
  const save = api.grade.save.useMutation();
  const remove = api.grade.remove.useMutation();
  const task = useTask();
  const student = people.data?.find((p) => p.id === studentId);
  const subjectOptions =
    subjects.data?.filter(
      (s) => s.classRoomId === student?.classRoomId || s.id === form.subjectId,
    ) ?? [];
  return (
    <>
      <Heading
        title="Grades"
        description="Assessment scores and subject averages, all in one place."
      >
        {role === "admin" && (
          <button
            className="btn"
            disabled={!studentId}
            onClick={() => {
              setForm({ ...blank, studentId });
              setShow(true);
            }}
          >
            + Add assessment
          </button>
        )}
      </Heading>
      {task.feedback}
      <Panel>
        <div className="filters">
          {role === "admin" && (
            <Field label="Student">
              <select
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setShow(false);
                }}
              >
                <option value="">Select student</option>
                {people.data
                  ?.filter((p) => p.role === "student")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} | {p.studentNumber}
                      {!p.isActive ? " (inactive)" : ""}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field label="Quarter">
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
            >
              <option value="">All quarters</option>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Quarter {q}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {role === "admin" && (
          <QueryState
            loading={people.isLoading || subjects.isLoading}
            error={people.error ?? subjects.error}
          />
        )}
      </Panel>
      {show && (
        <Panel title={form.id ? "Edit assessment" : "New assessment"}>
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
              <Field label="Subject">
                <select
                  required
                  value={form.subjectId || ""}
                  onChange={(e) =>
                    setForm({ ...form, subjectId: Number(e.target.value) })
                  }
                >
                  <option value="">Choose a subject</option>
                  {subjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assessment title">
                <input
                  required
                  maxLength={128}
                  placeholder="e.g. Fractions quiz"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </Field>
              <Field label="Type">
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as Form["type"] })
                  }
                >
                  {[
                    "quiz",
                    "assignment",
                    "exam",
                    "activity",
                    "project",
                    "final",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quarter">
                <select
                  value={form.quarter}
                  onChange={(e) =>
                    setForm({ ...form, quarter: Number(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Score">
                <input
                  type="number"
                  required
                  min={0}
                  max={form.total}
                  step="any"
                  value={form.score}
                  onChange={(e) =>
                    setForm({ ...form, score: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Total possible">
                <input
                  type="number"
                  required
                  min={0.01}
                  step="any"
                  value={form.total}
                  onChange={(e) =>
                    setForm({ ...form, total: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Remarks">
                <input
                  maxLength={1000}
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="actions mt-5">
              <button disabled={task.busy} className="btn">
                Save assessment
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
      {studentId ? (
        <>
          <QueryState
            loading={query.isLoading || summary.isLoading}
            error={query.error ?? summary.error}
          />
          <Panel title="Assessment records">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Subject / assessment</th>
                    <th>Type</th>
                    <th>Quarter</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Remarks</th>
                    {role === "admin" && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {query.data?.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <strong>{g.subject}</strong>
                        <div className="muted mt-1">{g.label}</div>
                      </td>
                      <td>{g.type}</td>
                      <td>{g.quarter ?? "-"}</td>
                      <td>
                        {g.score} / {g.total}
                      </td>
                      <td>{((g.score / g.total) * 100).toFixed(1)}%</td>
                      <td>{g.remarks?.trim() ? g.remarks : "-"}</td>
                      {role === "admin" && (
                        <td>
                          <div className="actions">
                            <button
                              className="btn secondary"
                              onClick={() => {
                                setForm({
                                  ...g,
                                  quarter: g.quarter ?? 1,
                                  remarks: g.remarks ?? "",
                                });
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
                                if (
                                  confirm("Delete this assessment permanently?")
                                )
                                  void task.run(
                                    () => remove.mutateAsync({ id: g.id }),
                                    "Assessment deleted.",
                                  );
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!query.data?.length && (
              <Empty>No assessments recorded for this selection.</Empty>
            )}
          </Panel>
          <Panel title="Subject summaries">
            <p className="muted mb-4 text-xs">
              Total points earned divided by total possible points. This is not
              a weighted or transmuted final grade.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Assessments</th>
                    <th>Points earned</th>
                    <th>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data?.map((s) => (
                    <tr key={s.subjectId}>
                      <td>{s.subject}</td>
                      <td>{s.count}</td>
                      <td>
                        {s.score} / {s.total}
                      </td>
                      <td>{s.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : (
        <Empty>Select a student to view or enter grades.</Empty>
      )}
    </>
  );
}
