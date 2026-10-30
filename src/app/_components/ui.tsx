"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { api } from "~/trpc/react";

type ConfirmationRequest = {
  title: string;
  description: string;
  confirmText: string;
  destructive?: boolean;
  onConfirm: () => void;
};

export function useConfirmation() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);

  return {
    requestConfirmation: (next: ConfirmationRequest) => setRequest(next),
    confirmationDialog: request ? (
      <ConfirmationDialog request={request} onClose={() => setRequest(null)} />
    ) : null,
  };
}

function ConfirmationDialog({
  request,
  onClose,
}: {
  request: ConfirmationRequest;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="app-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          dialog.current?.close();
      }}
    >
      <div
        className={
          request.destructive
            ? "app-dialog-icon destructive"
            : "app-dialog-icon"
        }
        aria-hidden="true"
      >
        !
      </div>
      <h2 id={titleId}>{request.title}</h2>
      <p id={descriptionId}>{request.description}</p>
      <div className="app-dialog-actions">
        <button
          type="button"
          className="btn secondary"
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          Cancel
        </button>
        <button
          type="button"
          className={request.destructive ? "btn danger" : "btn"}
          onClick={() => {
            const { onConfirm } = request;
            dialog.current?.close();
            onConfirm();
          }}
        >
          {request.confirmText}
        </button>
      </div>
    </dialog>
  );
}

export function MessageDialog({
  title,
  message,
  tone,
  onClose,
}: {
  title: string;
  message: string;
  tone: "error" | "success";
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="app-dialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          dialog.current?.close();
      }}
    >
      <div className={`app-dialog-icon ${tone}`} aria-hidden="true">
        {tone === "success" ? "✓" : "!"}
      </div>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId} role={tone === "error" ? "alert" : "status"}>
        {message}
      </p>
      <div className="app-dialog-actions">
        <button
          type="button"
          className="btn"
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          Got it
        </button>
      </div>
    </dialog>
  );
}

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
        {busy && (
          <LoadingScreen mode="overlay" label="Saving your changes..." />
        )}
        {error ? (
          <MessageDialog
            title="Something went wrong"
            message={error}
            tone="error"
            onClose={() => setError("")}
          />
        ) : message ? (
          <MessageDialog
            title="Complete"
            message={message}
            tone="success"
            onClose={() => setMessage("")}
          />
        ) : null}
      </>
    ),
  };
}

export function LoadingScreen({
  label = "Loading your workspace...",
  mode = "page",
}: {
  label?: string;
  mode?: "page" | "inline" | "overlay";
}) {
  return (
    <div
      className={`loading-screen loading-screen-${mode}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading-card">
        <div className="loading-mark" aria-hidden="true">
          <span className="loading-orbit" />
          <span className="loading-core" />
        </div>
        <p className="loading-brand">
          EduTrack<span>.</span>
        </p>
        <p className="loading-label">{label}</p>
        <div className="loading-progress" aria-hidden="true">
          <span />
        </div>
        {mode !== "inline" && (
          <div className="loading-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    </div>
  );
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
    <LoadingScreen mode="inline" label="Loading records..." />
  ) : error ? (
    <p role="alert" className="notice error">
      {error.message}
    </p>
  ) : null;
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
