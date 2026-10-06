"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Chart from "chart.js/auto";
import { Icon } from "./icon";
import { api } from "~/trpc/react";
import { csvCell, schoolToday } from "~/lib/school";
import { Heading, Panel, Field, QueryState, Empty } from "./ui";
function Plot({
  labels,
  series,
  type = "bar",
}: {
  labels: string[];
  series: { label: string; values: number[]; color: string }[];
  type?: "bar" | "line";
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type,
      data: {
        labels,
        datasets: series.map((s) => ({
          label: s.label,
          data: s.values,
          backgroundColor: s.color,
          borderColor: s.color,
          borderWidth: 2,
          borderRadius: 4,
          tension: 0.3,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 10, font: { size: 11 } },
          },
        },
        scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
      },
    });
    return () => chart.destroy();
  }, [labels, series, type]);
  return (
    <div className="chart-box">
      <canvas
        ref={ref}
        role="img"
        aria-label={series.map((s) => s.label).join(", ")}
      >
        Chart values are available in the report tables and CSV export.
      </canvas>
    </div>
  );
}
export function Reports({
  role,
  name,
  dashboard = false,
}: {
  role: string;
  name?: string | null;
  dashboard?: boolean;
}) {
  const today = schoolToday();
  const [from, setFrom] = useState(today.slice(0, 7) + "-01");
  const [to, setTo] = useState(today);
  const [classId, setClassId] = useState("");
  const [quarter, setQuarter] = useState("");
  const classes = api.admin.listClasses.useQuery(undefined, {
    enabled: role === "admin",
  });
  const query = api.report.overview.useQuery(
    {
      from,
      to,
      ...(classId ? { classRoomId: Number(classId) } : {}),
      ...(quarter ? { quarter: Number(quarter) } : {}),
    },
    { enabled: !!from && !!to && from <= to },
  );
  const announcements = api.announcement.list.useQuery();
  const d = query.data;
  function download(kind: "attendance" | "grades") {
    if (!d) return;
    const rows =
      kind === "attendance"
        ? [
            ["Student number", "Name", "Date", "Status", "Remarks"],
            ...d.attendanceRows.map((r) => [
              r.studentNumber,
              r.name,
              r.date,
              r.status,
              r.remarks,
            ]),
          ]
        : [
            [
              "Student number",
              "Name",
              "Subject",
              "Quarter",
              "Assessment",
              "Score",
              "Total",
              "Percentage",
            ],
            ...d.gradeRows.map((r) => [
              r.studentNumber,
              r.name,
              r.subject,
              r.quarter,
              r.label,
              r.score,
              r.total,
              ((r.score / r.total) * 100).toFixed(1),
            ]),
          ];
    const csv =
      String.fromCharCode(65279) +
      rows
        .map((row) => row.map(csvCell).join(","))
        .join(String.fromCharCode(13, 10));
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `edutrack-${kind}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <Heading
        title={
          dashboard
            ? `Welcome back, ${name?.split(" ")[0] ?? "there"}.`
            : "Reports & analytics"
        }
        description={
          dashboard
            ? "Here's what's happening in your school today."
            : "Explore attendance and academic performance, then export your records."
        }
      >
        <span className="badge">{today}</span>
      </Heading>
      {!dashboard && (
        <Panel>
          <div className="filters">
            <Field label="Attendance from">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="Attendance to">
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            {role === "admin" && (
              <Field label="Class">
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">All classes</option>
                  {classes.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Grade quarter">
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
          <div className="actions">
            <button
              className="btn secondary"
              disabled={!d || query.isFetching || from > to}
              onClick={() => download("attendance")}
            >
              Export attendance CSV
            </button>
            <button
              className="btn secondary"
              disabled={!d || query.isFetching || from > to}
              onClick={() => download("grades")}
            >
              Export grades CSV
            </button>
            <button className="btn secondary" onClick={() => window.print()}>
              Print report
            </button>
          </div>
          {from > to && (
            <p role="alert" className="notice error">
              Start date must be before end date.
            </p>
          )}
        </Panel>
      )}
      <QueryState loading={query.isLoading} error={query.error} />
      {d && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-icon">
                <Icon name="people" />
              </span>
              <p className="stat-label">
                {role === "admin" ? "Active students" : "My class"}
              </p>
              <p className="stat-number">
                {role === "admin"
                  ? d.roster.length
                  : (d.roster[0]?.className ?? "Unassigned")}
              </p>
              <small>
                {role === "admin"
                  ? "Enrolled in your school"
                  : (d.roster[0]?.studentNumber ??
                    "Contact your administrator")}
              </small>
            </div>
            <div className="stat">
              <span className="stat-icon">
                <Icon name="calendar" />
              </span>
              <p className="stat-label">
                {dashboard ? "Present today" : "Attendance rate"}
              </p>
              <p className="stat-number">
                {dashboard
                  ? d.todayPresent
                  : d.attendanceRate === null
                    ? "-"
                    : d.attendanceRate + "%"}
              </p>
              <small>Present and late count as attended</small>
            </div>
            <div className="stat">
              <span className="stat-icon">
                <Icon name="calendar" />
              </span>
              <p className="stat-label">
                {dashboard ? "Absent today" : "Absences"}
              </p>
              <p className="stat-number">
                {dashboard ? d.todayAbsent : d.counts.absent}
              </p>
              <small>
                {dashboard ? "Recorded today" : "Within selected dates"}
              </small>
            </div>
            <div className="stat">
              <span className="stat-icon">
                <Icon name="chart" />
              </span>
              <p className="stat-label">Academic average</p>
              <p className="stat-number">
                {d.average === null ? "-" : d.average + "%"}
              </p>
              <small>Total points earned / possible</small>
            </div>
          </div>
          <div className="chart-grid">
            <Panel title="Attendance trends">
              <p className="muted mb-5 text-xs">
                {from} through {to} | recorded school days
              </p>
              {d.trend.length ? (
                <Plot
                  type="line"
                  labels={d.trend.map((r) => r.date.slice(5))}
                  series={[
                    {
                      label: "Present",
                      values: d.trend.map((r) => r.present),
                      color: "#10b981",
                    },
                    {
                      label: "Absent",
                      values: d.trend.map((r) => r.absent),
                      color: "#f05265",
                    },
                    {
                      label: "Late",
                      values: d.trend.map((r) => r.late),
                      color: "#f5b432",
                    },
                    {
                      label: "Excused",
                      values: d.trend.map((r) => r.excused),
                      color: "#94a3b8",
                    },
                  ]}
                />
              ) : (
                <Empty>
                  Attendance charts will appear when records are saved.
                </Empty>
              )}
            </Panel>
            <Panel title="Performance by subject">
              <p className="muted mb-5 text-xs">
                {quarter ? `Quarter ${quarter}` : "All quarters"} | percentage
                of total points
              </p>
              {d.subjects.length ? (
                <Plot
                  labels={d.subjects.map((s) => s.subject)}
                  series={[
                    {
                      label: "Score %",
                      values: d.subjects.map((s) => s.percentage ?? 0),
                      color: "#1685ff",
                    },
                  ]}
                />
              ) : (
                <Empty>No assessments recorded yet.</Empty>
              )}
            </Panel>
          </div>
          {dashboard ? (
            <div className="chart-grid">
              <Panel title="Recent announcements">
                {announcements.data?.slice(0, 3).map((a) => (
                  <article key={a.id} className="announcement">
                    <small>{new Date(a.createdAt).toLocaleDateString()}</small>
                    <h3 className="mt-2">{a.title}</h3>
                    <p className="muted mt-2">{a.body}</p>
                  </article>
                ))}
                {!announcements.data?.length && (
                  <Empty>No announcements yet.</Empty>
                )}
                <Link className="btn secondary" href="/announcements">
                  All announcements
                </Link>
              </Panel>
              <Panel title="Quick actions">
                <p className="muted mb-5">
                  {role === "admin"
                    ? "Keep school records up to date, one class at a time."
                    : "Stay up to date with your attendance and academic progress."}
                </p>
                <div className="actions">
                  <Link className="btn" href="/attendance">
                    {role === "admin" ? "Record attendance" : "My attendance"}
                  </Link>
                  <Link className="btn secondary" href="/grades">
                    {role === "admin" ? "Manage grades" : "My grades"}
                  </Link>
                  <Link className="btn secondary" href="/reports">
                    View reports
                  </Link>
                </div>
              </Panel>
            </div>
          ) : (
            <>
              <Panel title="Attendance totals">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Present</th>
                        <th>Absent</th>
                        <th>Late</th>
                        <th>Excused</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{d.counts.present}</td>
                        <td>{d.counts.absent}</td>
                        <td>{d.counts.late}</td>
                        <td>{d.counts.excused}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel title="Student performance">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Student number</th>
                        <th>Points</th>
                        <th>Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.students.map((s) => (
                        <tr key={s.studentNumber}>
                          <td>{s.name}</td>
                          <td>{s.studentNumber}</td>
                          <td>
                            {s.score} / {s.total}
                          </td>
                          <td>{s.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!d.students.length && (
                  <Empty>No grades match these filters.</Empty>
                )}
              </Panel>
              <p className="muted text-xs">
                Attendance uses the selected date range. Grades use the selected
                quarter across all recorded assessments; these are point-based
                percentages, not a school-specific weighted grading formula.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
