"use client";
import { useState, type ReactNode } from "react";
import { api } from "~/trpc/react";
export function useTask() {
  const utils = api.useUtils();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function run(
    task: () => Promise<unknown>,
    success = "Saved successfully.",
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      await utils.invalidate();
      setMessage(success);
      return true;
    } catch (e) {
      await utils.invalidate();
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    run,
    feedback: (
      <>
        <p role="alert" className={error ? "notice error" : "hidden"}>
          {error}
        </p>
        <p role="status" className={message ? "notice success" : "hidden"}>
          {message}
        </p>
      </>
    ),
  };
}
export function Heading({
  eyebrow = "YOUR SCHOOL, CONNECTED",
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted mt-2">{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Panel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({
  children = "No records yet.",
}: {
  children?: ReactNode;
}) {
  return <p className="empty">{children}</p>;
}
export function QueryState({
  loading,
  error,
}: {
  loading: boolean;
  error?: { message: string } | null;
}) {
  return loading ? (
    <p role="status" className="empty">
      Loading records...
    </p>
  ) : error ? (
    <p role="alert" className="notice error">
      {error.message}
    </p>
  ) : null;
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
