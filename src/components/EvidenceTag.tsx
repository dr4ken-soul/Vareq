import type { PropsWithChildren } from "react";

export function EvidenceTag({ kind = "neutral", children }: PropsWithChildren<{ kind?: "neutral" | "success" | "warning" | "error" }>) {
  const icon = kind === "success" ? "✓" : kind === "error" ? "!" : kind === "warning" ? "◷" : "·";
  return <span className={"status-tag " + kind}><span aria-hidden="true">{icon}</span>{children}</span>;
}