import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useCreateWallet, useIdentityToken, usePrivy, useWallets } from "@privy-io/react-auth";
import scenario from "../scenarios/refund-fill-race.json";
import patchedRunJson from "./data/published/patched-refund-fill-race.json";
import vulnerableRunJson from "./data/published/vulnerable-refund-fill-race.json";
import { assertSupportedArtifact, createArtifact, executeReferenceModel, type RunArtifact, type RunResult } from "../packages/core/src";
import type { Scenario } from "../packages/core/src/schema";
import { EvidenceTag } from "./components/EvidenceTag";

const primary = "button button-primary";
const secondary = "button button-secondary";
const textLink = "text-link";
const privyConfigured = Boolean(import.meta.env.VITE_PRIVY_APP_ID?.trim());
const aiEnabled = import.meta.env.VITE_ENABLE_AI === "true";
const testnetEnabled = import.meta.env.VITE_ENABLE_TESTNET === "true";
const publishedRuns: RunArtifact[] = [vulnerableRunJson, patchedRunJson] as unknown as RunArtifact[];
publishedRuns.forEach((artifact) => assertSupportedArtifact(artifact));

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
  return payload;
}

function useMotionReveals() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("motion-ready");
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting) element.classList.add("is-visible");
        else if (entry.boundingClientRect.top > window.innerHeight || entry.boundingClientRect.bottom < 0) element.classList.remove("is-visible");
      }
    }, { threshold: 0.15 });
    document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
    return () => { observer.disconnect(); document.documentElement.classList.remove("motion-ready"); };
  }, []);
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("how-it-works");
  const location = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
    };
    window.addEventListener("keydown", closeOnEscape);
    document.querySelector<HTMLElement>("[data-mobile-menu] a")?.focus();
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", closeOnEscape); };
  }, [menuOpen]);
  useEffect(() => {
    if (location.pathname !== "/") { setActive(""); return; }
    const nodes = ["how-it-works", "evidence", "trust"].map((id) => document.getElementById(id)).filter(Boolean) as Element[];
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (current) setActive(current.target.id);
    }, { rootMargin: "-25% 0px -60% 0px", threshold: [0, 0.2, 0.5] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [location.pathname]);
  const links = [["How it works", "/#how-it-works"], ["Evidence", "/#evidence"], ["Trust", "/#trust"], ["Inspector", "/app/runs"]];
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header"><div className="header-inner">
      <Link className="wordmark" to="/" aria-label="Vareq home">Vareq</Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map(([label, href]) => {
          const id = href.split("#")[1] || "";
          const current = label === "Inspector" ? location.pathname.startsWith("/app/runs") : active === id || (!active && id === "how-it-works");
          return <a key={label} className={"nav-link" + (current ? " active" : "")} href={href} aria-current={current ? "page" : undefined}>{label}</a>;
        })}
      </nav>
      <Link className={primary + " header-action"} to="/app/runs">Explore a test run</Link>
      <button ref={menuButton} className="icon-button menu-trigger" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((value) => !value)}>
        <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
      </button>
    </div></header>
    {menuOpen && <>
      <button type="button" aria-label="Close navigation" className="mobile-backdrop" onClick={() => setMenuOpen(false)} />
      <nav id="mobile-navigation" data-mobile-menu className="mobile-menu" aria-label="Mobile navigation">
        {links.map(([label, href]) => <a key={label} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
        <Link className={primary} to="/app/runs" onClick={() => setMenuOpen(false)}>Explore a test run</Link>
      </nav>
    </>}
  </>;
}

function Footer() {
  return <footer className="site-footer">
    <div className="container footer-top">
      <div><Link className="wordmark" to="/">Vareq</Link><p className="footer-description">A bridge-testing workflow with explicit evidence and limits.</p></div>
      <nav className="footer-links" aria-label="Footer navigation">
        <a className={textLink} href="/#how-it-works">How it works</a>
        <Link className={textLink} to="/app/runs">Inspector</Link>
        <a className={textLink} href="https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail" target="_blank" rel="noreferrer">Event</a>
      </nav>
    </div>
    <div className="container footer-meta">Testnet demonstration. No production funds.</div>
  </footer>;
}

function Hero() {
  const rows = [["01", "Lock", "example"], ["02", "Hold fill delivery", "example"], ["03", "Request refund", "example"], ["04", "Attempt fill", "example"]];
  return <section className="hero"><div className="container hero-grid">
    <div className="hero-copy">
      <p className="eyebrow reveal">BRIDGE TESTING / BUILT FOR REVIEW</p>
      <h1 className="reveal">Expose bridge races before deployment.</h1>
      <p className="hero-subtitle reveal">AI proposes attack scenarios. Deterministic tests explore event orderings and replay failures for inspection.</p>
      <div className="hero-actions reveal"><Link className={primary} to="/app/runs">Explore a test run</Link><a className={secondary} href="#how-it-works">See how it works</a></div>
      <p className="hero-meta">Local replay and testnet receipts are different evidence.</p>
    </div>
    <div className="hero-trace reveal">
      <div className="trace-head"><span>Scenario outline</span><EvidenceTag kind="neutral">Illustrative trace</EvidenceTag></div>
      <ol className="trace-list">{rows.map(([n, label, state]) => <li key={n}><span>{n}</span><span>{label}</span><small>{state}</small></li>)}</ol>
      <p className="trace-caption">An illustration, not an executed run or receipt.</p>
    </div>
  </div></section>;
}

function Problem() {
  return <section className="problem section-band"><div className="container problem-grid">
    <p className="eyebrow">THE PROBLEM</p>
    <div><h2>The gap between events is part of the attack surface.</h2><p className="section-copy">A refund can become valid while a fill message is still in flight. A single-chain success path does not describe every cross-chain ordering.</p></div>
  </div></section>;
}

const stages = [
  { num: "01", title: "Adapter", body: "Define the bridge actions, actors and invariants the harness is allowed to exercise.", caption: "Developer-authored interface", wide: true },
  { num: "02", title: "AI scenarios", body: "Suggest action sequences within a fixed schema; validation rejects unsupported or unsafe inputs.", caption: "Groq proposal · untrusted data", wide: false },
  { num: "03", title: "Deterministic scheduling", body: "Control local message delivery, logical time and event order within stated bounds.", caption: "Controlled local execution", wide: false },
  { num: "04", title: "Replay and inspect", body: "Review the recorded sequence, state transitions and invariant result with its evidence mode.", caption: "Recorded artefact · explicit provenance", wide: true },
];

function HowItWorks() {
  return <section className="section how-section" id="how-it-works"><div className="container">
    <p className="eyebrow reveal">HOW IT WORKS</p><h2 className="reveal">From bridge assumptions to an inspectable trace.</h2>
    <p className="section-copy reveal">Describe supported actions, suggest bounded scenarios, control the local schedule and inspect what happened.</p>
    <div className="bento-grid">{stages.map((card) => <article key={card.num} className={"surface stage-card reveal " + (card.wide ? "stage-wide" : "")}>
      <div className="card-head"><span className="status-tag neutral">{card.num}</span><span aria-hidden="true" className="card-index">{card.num}</span></div>
      <h3>{card.title}</h3><p className="section-copy">{card.body}</p><div className="divider" /><p className="mono-note">{card.caption}</p>
    </article>)}</div>
  </div></section>;
}

function EvidenceSection() {
  return <section className="section evidence-section section-band" id="evidence"><div className="container">
    <div className="evidence-head"><div><p className="eyebrow reveal">THE REFERENCE CASE</p><h2 className="reveal">One schedule. Two bridge models.</h2></div><p className="section-copy reveal">Compare an intentionally vulnerable fixture with a trusted-coordinator mitigation. Results appear only after a real run.</p></div>
    <div className="comparison-grid">
      <article className="surface comparison-card reveal"><div className="comparison-title"><h3>Vulnerable reference</h3><EvidenceTag kind="neutral">Not run</EvidenceTag></div><p className="section-copy">A delayed fill can follow a source refund. The operator&apos;s reimbursement attempt may then fail.</p><p className="boundary">Intentionally unsafe, test-only fixture. No real assets.</p></article>
      <article className="surface comparison-card reveal"><div className="comparison-title"><h3>Trusted-coordinator mitigation</h3><EvidenceTag kind="neutral">Not run</EvidenceTag></div><p className="section-copy">A trusted coordinator issues mutually exclusive fill or refund permits. This can prevent the demonstrated race under its assumptions.</p><p className="boundary">The coordinator can censor, fail or equivocate; this is not a production bridge or a safety proof.</p></article>
    </div>
    <div className="evidence-row"><div><strong>Evidence</strong><span>No testnet receipts published yet.</span></div><Link className={textLink} to="/app/runs">Open published runs</Link></div>
  </div></section>;
}

function BuilderSection() {
  const steps = [["01", "Describe the adapter", "Declare allowed actions, actors and invariants."], ["02", "Execute in CI", "Run curated or validated scenarios; fail on an unexpected violation."], ["03", "Inspect the artefact", "Share a sanitised trace with a reviewer."]];
  return <section className="section builder-section"><div className="container builder-grid">
    <div className="builder-copy"><p className="eyebrow reveal">FOR BUILDERS</p><h2 className="reveal">Fit the test into the workflow you already use.</h2><p className="section-copy reveal">A developer-authored adapter defines what can happen. The SDK and CI use the same bounded scenario and save an artefact for review.</p><Link className={textLink} to="/app/runs">Explore a test run <span aria-hidden="true">→</span></Link></div>
    <div className="outline-panel reveal"><div className="panel-title">Integration outline</div>{steps.map(([n, title, copy]) => <div className="outline-row" key={n}><span>{n}</span><div><strong>{title}</strong><p>{copy}</p></div></div>)}</div>
  </div></section>;
}

const trustItems = [
  ["AI proposes; tests decide.", "Model output is untrusted scenario data. A validator and defined invariants determine what can run and what the results mean."],
  ["Local replay is controlled.", "Reproducibility depends on the same fixture, inputs, seed, environment and tool versions. A browser model is not an EVM execution."],
  ["Public chains are not deterministic.", "Live transactions can be delayed, reordered or reorganised. Receipts are observations, not guaranteed cross-chain finality or atomicity."],
  ["The mitigation trusts a coordinator.", "It assumes a non-equivocating authority and an explicit receipt policy; it can lose liveness or fail if that authority is compromised."],
];

function TrustSection() {
  return <section className="section trust-section" id="trust"><div className="container trust-grid">
    <div><p className="eyebrow reveal">TRUST &amp; LIMITS</p><h2 className="reveal">A useful trace is honest about its limits.</h2><p className="section-copy reveal">Vareq helps explore specific failures. It does not prove a bridge safe.</p></div>
    <div className="trust-list">{trustItems.map(([title, body]) => <details className="trust-item reveal" key={title} open><summary>{title}<span aria-hidden="true">+</span></summary><p>{body}</p></details>)}</div>
  </div></section>;
}

function FinalAction() {
  return <section className="final-action"><div className="container final-action-inner">
    <div><p className="eyebrow light">START WITH THE TRACE</p><h2>See the sequence, not just the outcome.</h2><p>Explore a published example without connecting a wallet.</p></div>
    <Link className={primary + " button-on-dark"} to="/app/runs">Explore a test run</Link>
  </div></section>;
}

function LandingPage() {
  useMotionReveals();
  return <><main id="main-content"><Hero /><Problem /><HowItWorks /><EvidenceSection /><BuilderSection /><TrustSection /><FinalAction /></main><Footer /></>;
}

function Dialog({ children, onClose, titleId }: { children: React.ReactNode; onClose: () => void; titleId: string }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab" && dialog.current) {
        const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled])')];
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      }
    };
    window.addEventListener("keydown", listener);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", listener); document.body.style.overflow = ""; previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialog}>
      <button className="icon-button dialog-close" aria-label="Close" onClick={onClose} type="button">×</button>{children}
    </div>
  </div>;
}

function PrivyRunner({ onClose }: { onClose: () => void }) {
  const { ready, authenticated, login, linkWallet, user, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();
  const { createWallet } = useCreateWallet();
  const { wallets } = useWallets();
  const [results, setResults] = useState<Array<{ result: RunResult; artifact: RunArtifact }> | null>(null);
  const [error, setError] = useState("");
  const [walletAction, setWalletAction] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [proposal, setProposal] = useState<Scenario | null>(null);
  const [proposalModel, setProposalModel] = useState("");
  const activeScenario = proposal ?? scenario as unknown as Scenario;
  const chooseExternalWallet = async () => {
    setError("");
    setWalletAction(true);
    try { await linkWallet(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet connection was not completed."); }
    finally { setWalletAction(false); }
  };
  const createEmbeddedWallet = async () => {
    setError("");
    setWalletAction(true);
    try { await createWallet(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Embedded wallet creation was not completed."); }
    finally { setWalletAction(false); }
  };
  const run = async () => {
    setError("");
    try {
      const vulnerable = await executeReferenceModel(activeScenario, "vulnerable");
      const patched = await executeReferenceModel({ ...activeScenario, fixtureId: "reference-patched-v1" }, "patched");
      setResults([{ result: vulnerable, artifact: await createArtifact(vulnerable, "browser-model") }, { result: patched, artifact: await createArtifact(patched, "browser-model") }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The model run could not be completed."); }
  };
  const generateProposal = async () => {
    setError("");
    if (!aiConsent) {
      setError("Review and accept the Groq data notice before requesting a proposal.");
      return;
    }
    const wallet = wallets.find((item) => item.type === "ethereum");
    if (!wallet) {
      setError("Connect an Ethereum wallet before requesting an AI proposal.");
      return;
    }
    setAiBusy(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken || !identityToken) throw new Error("Refresh your Privy session and try again.");
      const requestBody = { walletAddress: wallet.address, scenario };
      const authHeaders = {
        authorization: "Bearer " + accessToken,
        "x-privy-identity-token": identityToken,
        "content-type": "application/json",
      };
      const challengeResponse = await fetch("/api/wallet-challenges", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(requestBody),
      });
      const challenge = await readApiResponse<{ challengeId: string; message: string }>(challengeResponse);
      const signature = await wallet.sign(challenge.message);
      const proposalResponse = await fetch("/api/scenarios", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ challengeId: challenge.challengeId, signature, scenario }),
      });
      const data = await readApiResponse<{
        scenario: Scenario;
        provenance: { provider: string; model: string; origin: "ai"; validated: boolean };
      }>(proposalResponse);
      setProposal(data.scenario);
      setProposalModel(data.provenance.provider + " · " + data.provenance.model);
      setResults(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The AI proposal could not be completed.");
    } finally {
      setAiBusy(false);
    }
  };
  const exportArtifact = (artifact: RunArtifact) => {
    const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = artifact.runId + ".json"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <Dialog onClose={onClose} titleId="runner-title">
    <p className="eyebrow">BOUNDED INTERACTIVE DEMO</p><h2 id="runner-title">Run the reference model</h2>
    <p className="dialog-copy">This executes in your browser. It does not run EVM contracts, submit transactions, or publish your trace.</p>
    {!ready ? <p role="status">Checking session…</p> : !authenticated ? <>
      <p className="dialog-copy">Choose Google or wallet login. Public run inspection stays available without signing in.</p><button className={primary} onClick={() => login()} type="button">Continue with Google or wallet</button>
    </> : !wallets.length ? <>
      <p className="dialog-copy">Wallet required for this action. Google login alone is not a connected wallet.</p>
      <button className={secondary} onClick={chooseExternalWallet} type="button" disabled={walletAction}>Connect an external wallet</button>
      <button className={secondary} onClick={createEmbeddedWallet} type="button" disabled={walletAction}>Create an embedded wallet</button>
      <p className="small-note">An embedded wallet is created only after you select that option.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
    </> : <>
      <p className="small-note">Connected wallet: <span className="mono">{wallets[0]?.address}</span>{user ? " · authenticated" : ""}</p>
      {aiEnabled ? <>
        <label className="ai-consent"><input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} /><span>I agree to send this bounded, curated scenario to Groq for an AI proposal. The proposal is untrusted data and will not be run until I choose the local model action.</span></label>
        <button className={secondary} onClick={generateProposal} type="button" disabled={!aiConsent || aiBusy}>{aiBusy ? "Requesting signed proposal…" : "Generate a bounded AI proposal"}</button>
      </> : <p className="small-note ai-status">AI proposals are implemented but remain disabled until the Vercel Privy, Groq, and atomic Redis settings are present and verified.</p>}
      {proposal && <p className="small-note">Validated AI proposal · {proposalModel} · Review its actions before running.</p>}
      {!results ? <button className={primary} onClick={run} type="button">Run same scenario in both models</button> : <div className="run-results">
        {results.map(({ result, artifact }) => <article className="result-card" key={result.fixture}>
          <div className="result-heading"><h3>{result.fixture === "vulnerable" ? "Vulnerable fixture" : "Patched fixture"}</h3><EvidenceTag kind={result.invariants[0].status === "violation" ? "error" : "success"}>{result.invariants[0].status === "violation" ? "Violation" : "Passed within tested bounds"}</EvidenceTag></div>
          <p className="result-summary">{result.invariants[0].reason}</p><p className="small-note">Mode: Browser reference model · Origin: {artifact.origin} · {result.trace.length} attempted actions</p>
          <ol className="result-trace">{result.trace.map((step) => <li key={step.stepId}><span className="mono">{step.stepId}</span><span>{step.kind}</span><EvidenceTag kind={step.status === "rejected" ? "warning" : "neutral"}>{step.status}</EvidenceTag></li>)}</ol>
          <button className={secondary} onClick={() => exportArtifact(artifact)} type="button">Export artefact</button>
        </article>)}
      </div>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </>}
  </Dialog>;
}

type ReceiptLookupResult = {
  network: string;
  chainId: number;
  transactionHash: string;
  status: "pending-or-not-found" | "success" | "reverted" | "unknown";
  receipt: null | { blockNumber: string; blockHash: string | null; confirmations: string; from: string | null; to: string | null };
  explorerUrl: string | null;
  evidenceMode?: string;
};

function ReceiptLookup() {
  const [network, setNetwork] = useState("base-sepolia");
  const [transactionHash, setTransactionHash] = useState("");
  const [result, setResult] = useState<ReceiptLookupResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const params = new URLSearchParams({ network, txHash: transactionHash.trim() });
      const response = await fetch("/api/testnet/receipts?" + params.toString());
      setResult(await readApiResponse<ReceiptLookupResult>(response));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The receipt could not be checked.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="receipt-lookup surface" aria-labelledby="receipt-lookup-title">
    <p className="eyebrow">PUBLIC TESTNET DATA</p>
    <h2 id="receipt-lookup-title">Verify a transaction receipt</h2>
    <p className="section-copy">This reads a submitted transaction from an allowlisted RPC and checks the network chain ID first. It does not send transactions or prove cross-chain finality.</p>
    <form className="receipt-form" onSubmit={verify}>
      <label>Network<select value={network} onChange={(event) => setNetwork(event.target.value)}><option value="base-sepolia">Base Sepolia</option><option value="portaldot-v3">Portaldot V3</option></select></label>
      <label>Transaction hash<input required minLength={66} maxLength={66} pattern="0x[a-fA-F0-9]{64}" value={transactionHash} onChange={(event) => setTransactionHash(event.target.value)} spellCheck={false} autoComplete="off" placeholder="0x…" /></label>
      <button className={primary} type="submit" disabled={busy}>{busy ? "Checking receipt…" : "Verify receipt"}</button>
    </form>
    {error && <p className="field-error" role="alert">{error}</p>}
    {result && <article className="receipt-result" aria-live="polite">
      <div className="result-heading"><strong>{result.network === "base-sepolia" ? "Base Sepolia" : "Portaldot V3"} · chain {result.chainId}</strong><EvidenceTag kind={result.status === "success" ? "success" : result.status === "reverted" ? "error" : "warning"}>{result.status}</EvidenceTag></div>
      <p className="small-note mono">{result.transactionHash}</p>
      {result.receipt && <p className="small-note">Block {result.receipt.blockNumber} · {result.receipt.confirmations} observed confirmation(s) · {result.receipt.blockHash ?? "block hash unavailable"}</p>}
      {result.explorerUrl && <a className={textLink} href={result.explorerUrl} target="_blank" rel="noreferrer">Open explorer receipt <span aria-hidden="true">↗</span></a>}
    </article>}
  </section>;
}

function RunList() {
  const [showRunner, setShowRunner] = useState(false);
  const close = () => setShowRunner(false);
  return <>
    <main id="main-content" className="inspector-main container">
      <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Published runs</span></nav>
      <div className="inspector-title-row"><div><p className="eyebrow">PUBLISHED RUNS</p><h1>Inspectable runs</h1><p>Public examples are viewable without a wallet.</p></div><button className={primary} type="button" onClick={() => setShowRunner(true)}>Run reference model</button></div>
      <section className="run-results published-run-list" aria-label="Published local model examples">{publishedRuns.map((artifact) => {
        const status = artifact.invariants[0]?.status ?? "incomplete";
        const isVulnerable = artifact.fixture === "vulnerable";
        return <article className="result-card" key={artifact.runId}>
          <div className="result-heading"><h3>{isVulnerable ? "Refund/fill race · Vulnerable fixture" : "Refund/fill race · Coordinator fixture"}</h3><EvidenceTag kind={status === "violation" ? "error" : status === "pass" ? "success" : "warning"}>{status === "violation" ? "Invariant violation" : status === "pass" ? "Pass within tested bounds" : "Incomplete"}</EvidenceTag></div>
          <p className="result-summary">{artifact.invariants[0]?.reason}</p>
          <p className="small-note">Mode: Local reference model · Seed {artifact.seed} · {artifact.trace.length} steps</p>
          <Link className={secondary} to={`/app/runs/${artifact.runId}`}>Inspect trace</Link>
        </article>;
      })}</section>
      <p className="small-note published-run-note">These examples are local model executions. They are not testnet receipts or proof about a deployed bridge.</p>
      {testnetEnabled ? <ReceiptLookup /> : <section className="receipt-lookup surface" aria-labelledby="receipt-lookup-title">
        <p className="eyebrow">TESTNET EVIDENCE</p><h2 id="receipt-lookup-title">Receipt lookup is waiting for live verification</h2>
        <p className="section-copy">The read-only receipt endpoint is implemented, but this feature remains off until the configured RPCs identify as their documented testnets and an actual test contract and interaction have been verified.</p>
      </section>}
    </main><Footer />
    {showRunner && (privyConfigured ? <PrivyRunner onClose={close} /> : <Dialog onClose={close} titleId="runner-title">
      <p className="eyebrow">BOUNDED INTERACTIVE DEMO</p><h2 id="runner-title">Wallet setup required</h2>
      <p className="dialog-copy">Browser actions require Privy authentication and a connected wallet. Set a valid VITE_PRIVY_APP_ID in the local .env and rebuild to enable this action. No execution has started.</p>
    </Dialog>)}
  </>;
}

function RunDetail() {
  const { runId } = useParams();
  const artifact = publishedRuns.find((run) => run.runId === runId);
  if (!artifact) return <><main id="main-content" className="inspector-main container"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><Link to="/app/runs">Published runs</Link><span aria-hidden="true">/</span><span aria-current="page">Run</span></nav><section className="empty-state surface"><EvidenceTag kind="warning">Not published</EvidenceTag><h1>Run not found or not published.</h1><p>Only reviewed, release-published traces appear at this address.</p><Link className={secondary} to="/app/runs">View published runs</Link></section></main><Footer /></>;
  const invariant = artifact.invariants[0];
  const status = invariant?.status ?? "incomplete";
  return <><main id="main-content" className="inspector-main container">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><Link to="/app/runs">Published runs</Link><span aria-hidden="true">/</span><span aria-current="page">{artifact.runId}</span></nav>
    <div className="inspector-title-row"><div><p className="eyebrow">LOCAL REFERENCE MODEL</p><h1>{artifact.title}</h1><p>{artifact.fixture === "vulnerable" ? "Vulnerable fixture" : "Trusted coordinator fixture"} · Seed {artifact.seed} · {artifact.trace.length} steps</p></div><EvidenceTag kind={status === "violation" ? "error" : status === "pass" ? "success" : "warning"}>{status === "violation" ? "Invariant violation" : status === "pass" ? "Pass within tested bounds" : "Incomplete"}</EvidenceTag></div>
    <article className="result-card result-detail"><h2>Terminal state</h2><p className="result-summary">{invariant?.reason ?? "No invariant result is available."}</p><ul className="terminal-state"><li>Source refund: <strong>{artifact.terminal.sourceRefunded ? "completed" : "not completed"}</strong></li><li>Destination fill: <strong>{artifact.terminal.destinationFilled ? "completed" : "not completed"}</strong></li><li>Operator reimbursement: <strong>{artifact.terminal.operatorReimbursed ? "completed" : "not completed"}</strong></li></ul></article>
    <section className="trace-detail" aria-labelledby="trace-title"><h2 id="trace-title">Execution trace</h2><p className="small-note">Logical ticks show reference-model order. No public-chain transactions are attached to this run.</p><ol className="result-trace">{artifact.trace.map((step) => <li key={step.stepId}><span className="mono">T{step.logicalTick}</span><span><strong>{step.kind}</strong><small>{step.summary}</small></span><EvidenceTag kind={step.status === "rejected" ? "warning" : "neutral"}>{step.status}</EvidenceTag></li>)}</ol></section>
    <p className="small-note">Input digest: <span className="mono">{artifact.inputDigest}</span></p>
    <Link className={secondary} to="/app/runs">Back to published runs</Link>
  </main><Footer /></>;
}

function NotFound() {
  return <><main id="main-content" className="inspector-main container"><section className="empty-state surface"><h1>Page not found.</h1><Link className={secondary} to="/">Return to Vareq</Link></section></main><Footer /></>;
}

export default function App() {
  return <><Header /><Routes><Route path="/" element={<LandingPage />} /><Route path="/app/runs" element={<RunList />} /><Route path="/app/runs/:runId" element={<RunDetail />} /><Route path="*" element={<NotFound />} /></Routes></>;
}
