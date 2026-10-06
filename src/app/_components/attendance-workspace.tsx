"use client";
import { useState } from "react";
import { api, type RouterInputs } from "~/trpc/react";
import { schoolToday } from "~/lib/school";
import { Heading, Panel, Field, Empty, QueryState, Badge, useTask } from "./ui";
const statuses = ["present", "absent", "late", "excused"] as const;
type Row = RouterInputs["attendance"]["saveClass"]["rows"][number];
export function AttendanceWorkspace({ role }: { role: string }) {
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(schoolToday());
  const [draft, setDraft] = useState<Record<string, Partial<Row>>>({});
  const [filter, setFilter] = useState("");
  const classes = api.admin.listClasses.useQuery(undefined, {
    enabled: role === "admin",
  });
  const roster = api.attendance.roster.useQuery(
    { classRoomId: Number(classId), date },
    { enabled: role === "admin" && !!classId && !!date },
  );
  const history = api.attendance.getAttendanceByStudent.useQuery(
    {},
    { enabled: role === "student" },
  );
  const save = api.attendance.saveClass.useMutation();
  const task = useTask();
  const rows =
    roster.data?.map((s) => ({
      ...s,
      status: draft[s.id]?.status ?? s.record?.status ?? "",
      remarks: draft[s.id]?.remarks ?? s.record?.remarks ?? "",
    })) ?? [];
  function changeFilter(update: () => void) {
    if (
      !Object.keys(draft).length ||
      confirm("Discard unsaved attendance changes?")
    ) {
      setDraft({});
      update();
    }
  }
  return (
    <>
      <Heading
        title="Attendance"
        description={
          role === "admin"
            ? "Record the school day. Update existing records whenever a correction is needed."
            : "Your daily attendance and school records."
        }
      />
      {task.feedback}
      {role === "admin" ? (
        <>
          <Panel>
            <div className="filters">
              <Field label="Class">
                <select
                  value={classId}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    changeFilter(() => setClassId(value));
                  }}
                >
                  <option value="">Select a class</option>
                  {classes.data?.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  max={schoolToday()}
                  value={date}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    changeFilter(() => setDate(value));
                  }}
                />
              </Field>
            </div>
            <QueryState loading={classes.isLoading} error={classes.error} />
            {!classId && (
              <Empty>Select a class to load its active students.</Empty>
            )}
          </Panel>
          {classId && (
            <Panel title="Class register">
              <QueryState loading={roster.isLoading} error={roster.error} />
              {rows.length > 0 && (
                <>
                  <div className="actions mb-4">
                    <button
                      className="btn secondary"
                      disabled={task.busy}
                      onClick={() =>
                        setDraft(
                          Object.fromEntries(
                            rows.map((r) => [
                              r.id,
                              {
                                status: "present" as const,
                                remarks: r.remarks,
                              },
                            ]),
                          ),
                        )
                      }
                    >
                      Mark all present
                    </button>
                    <span className="muted text-xs">
                      {rows.length} students &middot;{" "}
                      {rows.filter((r) => r.status).length} marked
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Student number</th>
                          <th>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td>{r.name}</td>
                            <td>{r.studentNumber}</td>
                            <td>
                              <select
                                aria-label={`Attendance for ${r.name}`}
                                value={r.status}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    [r.id]: {
                                      ...draft[r.id],
                                      status: e.target.value as Row["status"],
                                    },
                                  })
                                }
                              >
                                <option value="" disabled>
                                  Not marked
                                </option>
                                {statuses.map((s) => (
                                  <option value={s} key={s}>
                                    {s[0]!.toUpperCase() + s.slice(1)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                aria-label={`Remarks for ${r.name}`}
                                maxLength={1000}
                                placeholder="Optional note"
                                value={r.remarks}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    [r.id]: {
                                      ...draft[r.id],
                                      remarks: e.target.value,
                                    },
                                  })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="actions mt-5">
                    <button
                      className="btn"
                      disabled={
                        task.busy ||
                        roster.isFetching ||
                        rows.some((r) => !r.status)
                      }
                      onClick={() =>
                        void task.run(async () => {
                          await save.mutateAsync({
                            classRoomId: Number(classId),
                            date,
                            rows: rows.map((r) => ({
                              studentId: r.id,
                              status: r.status as Row["status"],
                              remarks: r.remarks,
                            })),
                          });
                          setDraft({});
                        }, "Attendance saved. Absence notifications are ready for review.")
                      }
                    >
                      {task.busy ? "Saving..." : "Save attendance"}
                    </button>
                    <span className="muted text-xs">
                      Mark every student before saving.
                    </span>
                  </div>
                </>
              )}
              {!roster.isLoading && !rows.length && (
                <Empty>
                  No active students in this class. Assign students on the
                  People page.
                </Empty>
              )}
            </Panel>
          )}
        </>
      ) : (
        <Panel title="My attendance history">
          <Field label="Filter by status">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <QueryState loading={history.isLoading} error={history.error} />
          <div className="table-wrap mt-5">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {history.data
                  ?.filter((r) => !filter || r.status === filter)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>
                        <Badge>{r.status}</Badge>
                      </td>
                      <td>{r.remarks?.trim() ? r.remarks : "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!history.data?.filter((r) => !filter || r.status === filter)
            .length && <Empty>No attendance records match this filter.</Empty>}
        </Panel>
      )}
    </>
  );
}
