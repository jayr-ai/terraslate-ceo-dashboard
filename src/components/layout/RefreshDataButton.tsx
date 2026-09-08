import { useEffect, useRef, useState } from "react";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import styles from "./RefreshDataButton.module.css";

const WORKER_URL = "https://terraslate-ceo-dashboard-refresh.jayr-ai.workers.dev";
const GITHUB_RUNS_URL =
  "https://api.github.com/repos/jayr-ai/terraslate-ceo-dashboard/actions/runs?event=workflow_dispatch&per_page=5";
const POLL_INTERVAL_MS = 6000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000; // give up after 6 minutes

type State =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "running"; since: number }
  | { kind: "success" }
  | { kind: "error"; message: string }
  | { kind: "cooldown"; remainingMs: number };

export function RefreshDataButton() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  function startCooldownCountdown(remainingMs: number) {
    setState({ kind: "cooldown", remainingMs });
    const startedAt = Date.now();
    cooldownRef.current = setInterval(() => {
      const left = remainingMs - (Date.now() - startedAt);
      if (left <= 0) {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        setState({ kind: "idle" });
      } else {
        setState({ kind: "cooldown", remainingMs: left });
      }
    }, 1000);
  }

  function pollForCompletion(triggeredAt: number) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    pollRef.current = setInterval(async () => {
      if (Date.now() > deadline) {
        if (pollRef.current) clearInterval(pollRef.current);
        setState({ kind: "error", message: "Taking longer than expected — check back shortly." });
        return;
      }
      try {
        const res = await fetch(GITHUB_RUNS_URL);
        if (!res.ok) return; // transient — keep polling
        const data = await res.json();
        const run = (data.workflow_runs as Array<Record<string, unknown>>).find(
          (r) => new Date(r.created_at as string).getTime() >= triggeredAt - 15000,
        );
        if (!run) return; // run not indexed yet — keep polling
        if (run.status !== "completed") return; // still queued/in_progress
        if (pollRef.current) clearInterval(pollRef.current);
        if (run.conclusion === "success") {
          setState({ kind: "success" });
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setState({ kind: "error", message: "The refresh run failed — check GitHub Actions." });
        }
      } catch {
        // network hiccup — keep polling
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleClick() {
    if (state.kind === "starting" || state.kind === "running") return;
    setState({ kind: "starting" });
    try {
      const res = await fetch(`${WORKER_URL}/trigger`, { method: "POST" });
      const body = await res.json();
      if (res.status === 429) {
        startCooldownCountdown(body.remainingMs ?? 60000);
        return;
      }
      if (!res.ok || !body.ok) {
        setState({ kind: "error", message: "Couldn't start the refresh — try again." });
        setTimeout(() => setState({ kind: "idle" }), 4000);
        return;
      }
      const since = Date.now();
      setState({ kind: "running", since });
      pollForCompletion(since);
    } catch {
      setState({ kind: "error", message: "Couldn't reach the refresh service." });
      setTimeout(() => setState({ kind: "idle" }), 4000);
    }
  }

  const label = (() => {
    switch (state.kind) {
      case "idle":
        return "Refresh Data";
      case "starting":
        return "Starting…";
      case "running":
        return "Refreshing… (1–5 min)";
      case "success":
        return "Updated!";
      case "error":
        return state.message;
      case "cooldown":
        return `Wait ${Math.ceil(state.remainingMs / 1000)}s`;
    }
  })();

  const spinning = state.kind === "starting" || state.kind === "running";
  const disabled = state.kind !== "idle" && state.kind !== "error";

  return (
    <button
      type="button"
      className={`${styles.button} ${styles[state.kind]}`}
      onClick={handleClick}
      disabled={disabled}
      title="Pull the latest data from the source sheet and redeploy"
    >
      {state.kind === "success" ? (
        <Check size={15} strokeWidth={2.5} />
      ) : state.kind === "error" ? (
        <AlertCircle size={15} strokeWidth={2} />
      ) : (
        <RefreshCw size={15} strokeWidth={2} className={spinning ? styles.spin : undefined} />
      )}
      <span className={styles.label}>{label}</span>
    </button>
  );
}
