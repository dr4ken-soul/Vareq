import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCreateWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  isAddress,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { EvidenceTag } from "./components/EvidenceTag";

const primary = "button button-primary";
const secondary = "button button-secondary";
const sourceAbi = parseAbi([
  "function lock(bytes32 transferId,uint256 units)",
  "function refund(bytes32 transferId)",
  "function getTransfer(bytes32 transferId) view returns (address user,uint256 units,bool exists,bool fillAuthorized,bool refunded,bool reimbursed)",
]);
const baseReadClient = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org", { timeout: 15000 }) });
const privyConfigured = Boolean(import.meta.env.VITE_PRIVY_APP_ID?.trim());
const testnetEnabled = import.meta.env.VITE_ENABLE_TESTNET === "true";

type Mode = "vulnerable" | "patched";
type LiveState = { user: Address; units: bigint; exists: boolean; fillAuthorized: boolean; refunded: boolean; reimbursed: boolean };

const sourceAddresses: Record<Mode, Address | null> = {
  vulnerable: isAddress(import.meta.env.VITE_BASE_SEPOLIA_SOURCE_VULNERABLE_ADDRESS?.trim() ?? "") ? import.meta.env.VITE_BASE_SEPOLIA_SOURCE_VULNERABLE_ADDRESS.trim() as Address : null,
  patched: isAddress(import.meta.env.VITE_BASE_SEPOLIA_SOURCE_PATCHED_ADDRESS?.trim() ?? "") ? import.meta.env.VITE_BASE_SEPOLIA_SOURCE_PATCHED_ADDRESS.trim() as Address : null,
};

function newTransferId(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  if (bytes.every((byte) => byte === 0)) bytes[31] = 1;
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}` as Hex;
}

function WalletSetup() {
  return <section className="receipt-lookup surface"><p className="eyebrow">TESTNET WALLET SETUP</p><h2>Wallet actions are not configured</h2><p className="section-copy">A valid VITE_PRIVY_APP_ID is required for the user-signed Base Sepolia flow. The public run inspector remains available.</p><Link className={secondary} to="/app/runs">Open published runs</Link></section>;
}

function ConnectedTestnetFlow() {
  const { ready, authenticated, login, linkWallet } = usePrivy();
  const { createWallet } = useCreateWallet();
  const { wallets } = useWallets();
  const [mode, setMode] = useState<Mode>("patched");
  const [units, setUnits] = useState(1);
  const [transferId, setTransferId] = useState<Hex | null>(null);
  const [lockHash, setLockHash] = useState<Hex | null>(null);
  const [refundHash, setRefundHash] = useState<Hex | null>(null);
  const [state, setState] = useState<LiveState | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [walletAction, setWalletAction] = useState(false);
  const wallet = wallets.find((item) => item.type === "ethereum");
  const sourceAddress = sourceAddresses[mode];
  useEffect(() => {
    let cancelled = false;
    if (!wallet) { setChainId(null); return; }
    void wallet.getEthereumProvider().then((provider) => provider.request({ method: "eth_chainId" })).then((current) => {
      if (!cancelled) setChainId(typeof current === "string" ? Number.parseInt(current, 16) : Number(current));
    }).catch(() => { if (!cancelled) setChainId(null); });
    return () => { cancelled = true; };
  }, [wallet?.address]);
  const canChangeMode = !transferId || state?.refunded || state?.reimbursed;
  const operatorCommands = useMemo(() => {
    if (!transferId || !lockHash || !state?.exists) return null;
    return {
      authorize: `bun run testnet:operator --stage authorize --mode ${mode} --transfer-id ${transferId} --source-lock ${lockHash} --approve`,
      settle: `bun run testnet:operator --stage settle --mode ${mode} --transfer-id ${transferId} --approve`,
    };
  }, [lockHash, mode, state?.exists, transferId]);
  const nativeEvidenceCommands = useMemo(() => {
    if (!transferId || !lockHash) return null;
    const common = `--mode ${mode} --transfer-id ${transferId} --approve --broadcast`;
    return {
      deploy: `bun run testnet:portaldot-contract -- --stage deploy --mode ${mode} --approve --broadcast`,
      attest: `bun run testnet:portaldot-contract -- --stage attest ${common} --source-transaction ${lockHash}`,
      refund: refundHash && state?.refunded ? `bun run testnet:portaldot-contract -- --stage refund ${common} --refund-transaction ${refundHash}` : null,
      fill: `bun run testnet:portaldot-contract -- --stage fill ${common}`,
    };
  }, [lockHash, mode, refundHash, state?.refunded, transferId]);

  const refreshState = async () => {
    if (!sourceAddress || !transferId) return;
    setError("");
    try {
      const current = await baseReadClient.readContract({ address: sourceAddress, abi: sourceAbi, functionName: "getTransfer", args: [transferId] });
      const [user, amount, exists, fillAuthorized, refunded, reimbursed] = current;
      setState({ user, units: amount, exists, fillAuthorized, refunded, reimbursed });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Base Sepolia state could not be read.");
    }
  };

  const getWalletClient = async () => {
    if (!wallet) throw new Error("Connect an Ethereum wallet before signing the source transaction.");
    const provider = await wallet.getEthereumProvider();
    const current = await provider.request({ method: "eth_chainId" });
    const actual = typeof current === "string" ? Number.parseInt(current, 16) : Number(current);
    setChainId(actual);
    if (actual !== baseSepolia.id) throw new Error("Switch the connected wallet to Base Sepolia (chain 84532), then try again.");
    return createWalletClient({ account: wallet.address as Address, chain: baseSepolia, transport: custom(provider) });
  };

  const switchToBaseSepolia = async () => {
    if (!wallet) return;
    setError("");
    setBusy("switching");
    try {
      await wallet.switchChain(baseSepolia.id);
      const provider = await wallet.getEthereumProvider();
      const current = await provider.request({ method: "eth_chainId" });
      setChainId(typeof current === "string" ? Number.parseInt(current, 16) : Number(current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The wallet could not switch to Base Sepolia.");
    } finally { setBusy(""); }
  };

  const lock = async () => {
    if (!testnetEnabled) { setError("Testnet actions are disabled by the Vareq configuration."); return; }
    if (!sourceAddress) { setError("The selected source fixture has not been deployed and configured yet."); return; }
    if (!Number.isInteger(units) || units < 1 || units > 10) { setError("Choose between 1 and 10 valueless test units."); return; }
    setError(""); setNotice(""); setBusy("lock"); setState(null); setRefundHash(null);
    try {
      const client = await getWalletClient();
      const id = newTransferId();
      const hash = await client.writeContract({ address: sourceAddress, abi: sourceAbi, functionName: "lock", args: [id, BigInt(units)] });
      setTransferId(id); setLockHash(hash);
      setNotice("Source lock submitted on Base Sepolia. Waiting for its receipt; keep this transaction hash if the RPC times out.");
      const receipt = await baseReadClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180000 });
      if (receipt.status !== "success") throw new Error("The source lock transaction reverted. No operator action should follow.");
      setNotice("Source lock confirmed on Base Sepolia. Operator activity remains manual and separate.");
      const current = await baseReadClient.readContract({ address: sourceAddress, abi: sourceAbi, functionName: "getTransfer", args: [id] });
      const [user, amount, exists, fillAuthorized, refunded, reimbursed] = current;
      setState({ user, units: amount, exists, fillAuthorized, refunded, reimbursed });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The source lock did not complete.");
    } finally { setBusy(""); }
  };

  const refund = async () => {
    if (!sourceAddress || !transferId) return;
    setError(""); setNotice(""); setBusy("refund");
    try {
      const client = await getWalletClient();
      const hash = await client.writeContract({ address: sourceAddress, abi: sourceAbi, functionName: "refund", args: [transferId] });
      setRefundHash(hash);
      const receipt = await baseReadClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 180000 });
      if (receipt.status !== "success") {
        setNotice("The refund call reverted. Refresh the observed source state before continuing.");
      } else {
        setNotice("Source refund confirmed on Base Sepolia.");
      }
      await refreshState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The refund action was not completed.");
    } finally { setBusy(""); }
  };

  const connectExternal = async () => {
    setError(""); setWalletAction(true);
    try { await linkWallet(); } catch (cause) { setError(cause instanceof Error ? cause.message : "External wallet connection failed."); }
    finally { setWalletAction(false); }
  };

  const createEmbedded = async () => {
    setError(""); setWalletAction(true);
    try { await createWallet(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Embedded wallet creation failed."); }
    finally { setWalletAction(false); }
  };

  return <main id="main-content" className="inspector-main container live-testnet-main">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Live testnet</span></nav>
    <div className="inspector-title-row"><div><p className="eyebrow">OPERATOR-ASSISTED TESTNET</p><h1>Base Sepolia → Portaldot V3</h1><p>The source uses Base Sepolia EVM receipts. The native destination uses Portaldot's Substrate contracts pallet and SS58 operator and attester accounts. The existing Portaldot EVM fixture remains a separate route.</p></div><EvidenceTag kind={testnetEnabled && sourceAddress ? "warning" : "neutral"}>{!testnetEnabled ? "Live actions disabled" : sourceAddress ? "Live actions enabled" : "Contracts not deployed"}</EvidenceTag></div>

    <section className="receipt-lookup surface live-boundary"><p className="eyebrow">LIVE DEMO BOUNDARY</p><p className="section-copy">These contracts store at most 10 valueless test units and transfer no tokens. The attester is trusted and manually operated; this is not a bridge or proof of finality. Vareq never receives the user's or operator's private key.</p></section>

    {!ready ? <section className="receipt-lookup surface"><p role="status">Checking wallet session…</p></section> : !authenticated ? <section className="receipt-lookup surface"><p className="eyebrow">SIGN IN TO ACT</p><h2>Connect a test wallet</h2><p className="section-copy">Public pages stay open. Authentication and a connected Ethereum wallet are required before asking your wallet to sign a testnet action.</p><button className={primary} type="button" onClick={() => login()}>Continue with Google or wallet</button></section> : !wallet ? <section className="receipt-lookup surface"><p className="eyebrow">ETHEREUM WALLET REQUIRED</p><h2>Choose a wallet for Base Sepolia</h2><p className="section-copy">The SS58 address used to request Portaldot gas does not provide an EVM signing key. Connect an Ethereum wallet or explicitly create a Privy embedded wallet for the source action.</p><div className="live-actions"><button className={secondary} type="button" onClick={connectExternal} disabled={walletAction}>{walletAction ? "Opening wallet…" : "Connect external wallet"}</button><button className={secondary} type="button" onClick={createEmbedded} disabled={walletAction}>{walletAction ? "Creating wallet…" : "Create embedded wallet"}</button></div></section> : <>
      <section className="receipt-lookup surface"><div className="result-heading"><div><p className="eyebrow">CONNECTED USER WALLET</p><h2 className="live-wallet-address">{wallet.address}</h2></div><EvidenceTag kind={chainId === baseSepolia.id ? "success" : "warning"}>{chainId === baseSepolia.id ? "Base Sepolia" : chainId ? `Chain ${chainId}` : "Check network"}</EvidenceTag></div>
        {chainId !== baseSepolia.id && <button className={secondary} type="button" onClick={switchToBaseSepolia} disabled={busy !== ""}>{busy === "switching" ? "Switching…" : "Switch wallet to Base Sepolia"}</button>}
        <div className="receipt-form live-form"><label>Fixture<select value={mode} disabled={!canChangeMode || busy !== ""} onChange={(event) => {setMode(event.target.value as Mode);setTransferId(null);setLockHash(null);setRefundHash(null);setState(null);}}><option value="patched">Patched coordinator fixture</option><option value="vulnerable">Vulnerable race fixture</option></select></label><label>Valueless units (1–10)<input type="number" min={1} max={10} step={1} value={units} disabled={Boolean(transferId) || busy !== ""} onChange={(event) => setUnits(Number(event.target.value))} /></label></div>
        {!sourceAddress && <p className="field-error" role="status">This source fixture is not deployed yet. After both networks are funded, run the deployment command and configure the public Base contract address.</p>}
        <button className={primary} type="button" disabled={!testnetEnabled || !sourceAddress || busy !== "" || Boolean(transferId) || chainId !== baseSepolia.id} onClick={lock}>{busy === "lock" ? "Waiting for Base Sepolia…" : "Lock test units on Base Sepolia"}</button>
        {transferId && <div className="receipt-result live-run-details"><div className="result-heading"><strong>Transfer {transferId.slice(0, 12)}…</strong><EvidenceTag kind={state?.refunded ? "error" : state?.fillAuthorized ? "success" : "warning"}>{state?.refunded ? "Refunded" : state?.fillAuthorized ? "Fill authorized" : "Locked"}</EvidenceTag></div><p className="small-note mono">Transfer ID: {transferId}</p><p className="small-note mono">Source lock: {lockHash}</p>{lockHash && <a className="text-link" href={`https://sepolia.basescan.org/tx/${lockHash}`} target="_blank" rel="noreferrer">Open Base Sepolia receipt ↗</a>}
          {state && <ul className="live-state-list"><li>Source lock: <strong>{state.exists ? "confirmed" : "not observed"}</strong></li><li>Fill authorization: <strong>{state.fillAuthorized ? "confirmed" : "not yet observed"}</strong></li><li>Source refund: <strong>{state.refunded ? "confirmed" : "not observed"}</strong></li><li>Operator reimbursement: <strong>{state.reimbursed ? "confirmed" : "not observed"}</strong></li></ul>}
          <div className="live-actions"><button className={secondary} type="button" onClick={refreshState} disabled={busy !== ""}>Refresh source state</button><button className={secondary} type="button" onClick={refund} disabled={busy !== "" || !state?.exists || state.refunded || state.reimbursed}>{busy === "refund" ? "Waiting for refund receipt…" : "Request source refund"}</button></div>
          {refundHash && <p className="small-note mono">Refund attempt: {refundHash}</p>}
          {operatorCommands && state && !state.fillAuthorized && (mode === "vulnerable" || !state.refunded) && <div className="operator-steps"><p><strong>Operator stage 1 — manually approve fill</strong></p><p>Share the confirmed transfer ID and source lock transaction with the configured testnet operator. The EVM operator and attester may use the same test-only account, which removes independent role control. The operator reviews the run and explicitly approves:</p><code>{operatorCommands.authorize}</code></div>}
          {operatorCommands && state?.fillAuthorized && <div className="operator-steps"><p><strong>Operator stage 2 — manually settle</strong></p><p>In vulnerable mode, the user can request a source refund after authorization to exercise the race. The operator then separately approves the Portaldot fill and Base claim attempt:</p><code>{operatorCommands.settle}</code></div>}
          {operatorCommands && mode === "patched" && state?.refunded && !state.fillAuthorized && <p className="field-note" role="status">This patched transfer was refunded before operator approval, so the operator script will correctly refuse to authorize a destination fill.</p>}
          {nativeEvidenceCommands && <div className="operator-steps"><p><strong>Native Portaldot contracts-pallet path</strong></p><p>This separate native contract records the Base Sepolia lock after the SS58 attester verifies its successful receipt, then lets the distinct SS58 operator record a valueless fill. Deploy both vulnerable and patched fixtures before comparing modes. The operator needs tPOT for deployment and fill fees; the attester needs tPOT for attestations. Each action is a local CLI transaction separately approved by its signer. Keep encrypted Polkadot wallet exports and passwords outside Vercel and this repository.</p><p>One-time deployment for this fixture mode:</p><code>{nativeEvidenceCommands.deploy}</code><p>Attester — verifies the Base lock receipt and records it on Portaldot:</p><code>{nativeEvidenceCommands.attest}</code>{nativeEvidenceCommands.refund && <><p>Attester — records the confirmed Base refund:</p><code>{nativeEvidenceCommands.refund}</code></>}<p>Operator — records the native destination fill:</p><code>{nativeEvidenceCommands.fill}</code><p className="small-note">This is a genuine native contracts-pallet transaction path when deployed and broadcast. The Base event is checked by a trusted off-chain attester; the contract does not verify Base consensus, and no assets move.</p></div>}
        </div>}
        {notice && <p className="field-note" role="status">{notice}</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
      </section>
    </>}
    <section className="receipt-lookup surface"><p className="eyebrow">OBSERVED RECEIPTS</p><h2>Inspect the evidence</h2><p className="section-copy">Each transaction must be checked on its own chain. The operator CLI writes a sanitised JSON evidence file after it observes the fill and claim outcome.</p><Link className={secondary} to="/app/runs">Open receipt lookup</Link></section>
  </main>;
}

export default function LiveTestnetDemo() {
  return <>{privyConfigured ? <ConnectedTestnetFlow /> : <main id="main-content" className="inspector-main container"><WalletSetup /></main>}</>;
}
