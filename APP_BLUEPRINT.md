# Vareq — Application Blueprint

**Status:** planning only; no implementation approved or created.  
**Prepared:** 30 October 2026, Africa/Lagos.  
**Companion documents:** `FRONTEND_SPEC.md`, `BUILD_GUIDE.md`, `CLAUDE.md`, `SUBMISSION_CHECKLIST.md`, `RESEARCH_AND_DECISIONS.md`.

> **Decision boundary:** This document proposes an implementation. It does not assert that Vareq, its contracts, integrations, package, deployment, tests, or receipts already exist. Obtain explicit approval before creating project code or deploying anything.

## 1. Product identity and desired outcome

**Vareq** is a reusable, AI-assisted bridge-testing SDK and CI workflow with a public run inspector. It helps bridge teams explore a narrowly defined class of cross-chain timing failures: a delayed fill races a source-side refund, potentially leaving the destination-side operator unreimbursed. Groq proposes bounded scenario data; a deterministic local scheduler executes or replays allowed actions; engineers inspect the resulting event order and invariant outcomes.

**One sentence for a judge:** “Vareq turns a bridge timing hypothesis into a reproducible local test and a trace you can inspect, then connects the demonstration to separately labelled testnet evidence.”

**Positioning:** A bridge-specific scenario and evidence layer *alongside* general-purpose tools such as Foundry, Echidna, Medusa, and formal verification—not a replacement for them and not a claim of worldwide novelty. Foundry already has excellent fuzzing and replay. Vareq's proposed contribution is the packaged cross-chain action vocabulary, adapter boundary, explicit asynchronous race model, optional AI-suggested scenarios, and coherent inspector/CI artefact.

**Sponsor fit:** Multi-Chain & Cross-Chain Infra is the recommended primary track: Vareq exercises a bridge-security workflow with real Portaldot V3 interaction, subject to funded deployment. Do not claim a native or production Portaldot–Base bridge exists. The official judging weights are technical feasibility 30%, innovation 30%, ecosystem contribution 20%, and business potential 20%.

### Users and jobs

| User | Job | First-version experience |
|---|---|---|
| Bridge engineer | Test a refund/fill ordering before merging a change | Install the open-source core locally, implement the adapter, run bounded scenarios in CI, inspect an artefact. |
| Security reviewer | Understand why an invariant failed | Open a published, sanitised run; follow attempted actions, state changes, and supporting evidence without signing in. |
| Hackathon judge | See the difference between the reference vulnerability and a mitigation | Open the public example; if available, connect a wallet to run the bounded reference model or participate in the operator-assisted testnet demo. |

**Success is demonstrated, not asserted:** the vulnerable reference fails the defined invariant on a controlled local scenario; the mitigation avoids that *same* counterexample under stated trust assumptions; a CI job and public inspector expose the trace; real V3 and Base Sepolia receipts are independently verifiable. Each item stays “not yet verified” until actually produced.

## 2. Scope, exclusions and permissions

### MVP, ordered by value

1. **Local harness and reference fixture.** One vulnerable and one patched test-only bridge model; deterministic actions and a versioned run artefact; repeatable counterexample; parity tests between the browser reference model and local EVM fixture where behaviour overlaps.
2. **SDK/CLI and CI.** A documented adapter contract, scenario validation, local execution, exit status, and machine-readable trace. CI must work offline with curated scenarios; Groq is an optional augmentation.
3. **AI scenario suggestions.** A small allowlisted action vocabulary and strict schema, semantic validation, and explicit human-readable scenario origin. AI neither runs code nor decides whether an invariant holds.
4. **Public inspector and gated actions.** Read published traces without login. After Privy authentication and wallet connection, run the predefined browser reference model, replay a recorded trace, or request a bounded AI proposal. Read-only inspection and navigation stay public. A curated run remains viewable even when services fail.
5. **Testnet evidence.** Target Base Sepolia as the source and Portaldot V3 as the destination. The user signs their own source-side testnet actions; separately controlled, limited test-only operator/attester accounts perform their own roles. Operator assistance is required for the live demonstration; it is not an open transaction-relaying service.

**Explicitly excluded:** production contracts or real assets; a trustless asset bridge; arbitrary model-generated or user-uploaded code execution; unrestricted RPC targets or transactions; a public multi-tenant job runner; broad chain support; turnkey adapters for all real bridges; formal proofs; automatic remediation; autonomous AI wallet access; SaaS billing; customer-data collection; a paid dependency during the build.

**Open-source boundary:** Core SDK, reference fixtures, schemas, and documentation are intended to be open source. Exact licence remains an owner decision: recommend MIT for Vareq-authored work, subject to dependency and contribution review. A later hosted service is a hypothesis, not an MVP deliverable.

## 3. Critical distinction: three execution/evidence modes

| Mode | What is actually executed | What can be reproduced or verified | UI label |
|---|---|---|---|
| **Browser reference model** | A bounded, pure TypeScript model in a browser worker, using the same allowed scenario and deterministic scheduler rules. It is **not** the EVM. | Same reference model, initial fixture, version, seed, and inputs yield the same normalised model trace. Model/EVM parity must be tested rather than assumed. | “Local reference model” |
| **Local EVM harness** | Test-only contracts and adapter calls on controlled local EVM instances, with pinned state, versions, clock, transaction order, and actor accounts. | Normalised trace can be replayed under the same controlled environment. Anvil snapshots are ephemeral; reconstruction requires the persisted fixture and tool versions, not just a snapshot ID. | “Local EVM execution” |
| **Public testnets** | Actual separately signed testnet transactions and observed RPC receipts on Base Sepolia and Portaldot V3. | Transaction submission and receipt evidence can be checked independently. Cross-chain inclusion, order, reorgs, finality, timing and identical replay are **not controlled or guaranteed**. A playback of a recorded public trace is not a re-execution. | “Observed testnet transactions” |

An illustrative hero trace is neither a test result nor a receipt. A recorded playback is not proof that a new execution occurred. The inspector must carry the evidence mode and provenance on every result and must never substitute fabricated hashes or results.

## 4. The reference race and a limited mitigation

### Roles and assumptions

- **User:** controls the connected wallet and signs source-side testnet operations, such as approval/lock and, when applicable, a refund request. They never hand Vareq a private key.
- **Operator / liquidity provider:** a separate, test-only signer, manually budgeted and controlled by the builder; pays the destination-side demo token and later requests source-side reimbursement.
- **Coordinator / attester:** another test-only authority that issues intent permits and, after observing a destination transaction according to its configured policy, signs a claim attestation. It is a **trusted, potentially censoring, single point of failure**, not a light client or decentralised oracle. Demo operations must use small caps and never operate on mainnet.
- **Reference assets:** independently deployed valueless test tokens. Any 1:1 accounting in the model is a stated test-unit assumption, not a real bridge, USD valuation, or claim that tokens on different chains are economically equivalent.

### Same attempted scenario in both versions

| Order | Attempt | Vulnerable fixture: intended counterexample | Patched fixture: intended response |
|---|---|---|---|
| 1 | User locks reference units on source. | Lock recorded. | Lock recorded. |
| 2 | Coordinator issues a fill permit; delivery to the destination is delayed. | Permit exists but source refund does not take it into account. | Coordinator durably records the **fill** decision before signing; it must never sign a competing refund decision for this transfer. |
| 3 | Time advances past the configured refund point and a refund is requested. | Source refunds without a mutually exclusive coordinator decision. | Source requires a valid refund permit. Coordinator refuses a conflicting refund permit, so the refund is not authorised. |
| 4 | The old fill permit arrives and the operator fills on destination. | Destination accepts it; the operator pays the user. | Destination accepts the authorised fill. |
| 5 | Operator submits an attested destination fill for source reimbursement. | Reimbursement fails because the source already refunded. | If the destination fill is confirmed under the demo's configured attestation policy and the coordinator honestly attests it, source reimburses the operator. |

**Primary safety assertion:** for a transfer in the controlled fixture, the final observed state must not contain both `sourceRefunded = true` and `destinationFilled = true`. **Terminal accounting observation:** after the scheduled claim attempt, show whether the operator was paid on the source; an in-flight unpaid claim alone is not a safety violation.

The patched example intentionally trades liveness and decentralisation for a clear mitigation: permits are mutually exclusive only if the single coordinator persists its decision, never equivocates, uses proper domain separation and nonces, and follows its stated receipt/confirmation policy. A lost/offline or compromised coordinator can lock progress or violate assumptions. Reorgs, forged attestations, unauthorised signers, expired or replayed permits, and clock/network failure must be explicitly tested or disclosed. This is **not** a production-safe bridge design, audit, proof of finality, or guarantee that every attack has been found.

**Evidence discipline:** an actual vulnerable result requires observed source refund, destination fill and failed claim in that run. If one fails or times out, show “incomplete/observed so far,” not the desired outcome. If a public testnet cannot support the full race, present the genuine transactions as integration evidence and the local EVM result separately; never splice them into a fictional single race.

## 5. System architecture

```text
PUBLIC BROWSER                                 BUILDER / CI
 ┌──────────────────────────────┐             ┌───────────────────────────────┐
 │ Marketing + public inspector │             │ SDK + CLI                     │
 │ Published sanitised artefacts│             │ adapter / schema / invariants │
 │ Browser reference-model run  │             │ scheduler + local EVM harness │
 │ Privy + connected wallet     │             │ curated or Groq scenarios     │
 └───────┬───────────────┬──────┘             └───────┬───────────────┬───────┘
         │ read static    │ user-signed                 │ writes local  │ CI exit
         │ artefacts      │ testnet calls               │ run artefact  │ + artefact
         │                ▼                             ▼               ▼
         │       Base Sepolia source                 Published only after
         │          and Portaldot V3 destination     explicit sanitisation
         │                ▲
         │        operator/attester: separate test-only keys,
         │        manual approval, hard budgets, receipt observation
         │
         └─ authenticated bounded AI request ─► Pages Function ─► Groq
               Privy access-token verification, linked-wallet/session proof,
               per-subject/global limits, schema and semantic validation
               D1: short-lived one-use nonces + counters only
```

### Suggested stack and deployment

| Layer | Proposed choice | Reason / important constraint |
|---|---|---|
| Frontend | Vite, React, TypeScript, Tailwind; browser Web Worker for the reference model | Static-first public inspector; no server-side wallet or secret. Pin verified compatible releases at implementation. |
| Routing | React Router; Cloudflare Pages SPA fallback | Public routes must work on direct load. Cloudflare's fallback applies if no top-level `404.html`; verify deployment behavior. |
| Hosting | Cloudflare Pages free static assets; Pages Function for the AI gateway | Static assets and dynamic functions have different quotas. Free Workers/Functions currently share 100,000 requests/day and a 10 ms CPU limit per invocation. Establish compatibility/latency in a spike. |
| Limited server state | Cloudflare D1 free | One-use challenge nonces and atomic abuse counters only; no uploaded traces, wallet keys, provider prompts, or personal profile database. Fail closed if unavailable. |
| Identity and wallet | Privy React SDK; Google and external wallet login; embedded wallet only by explicit choice | Google login alone is not a connected wallet. No automatic wallet creation. User always confirms their own signature. |
| RPC / EVM | viem for browser and SDK reads/writes; Solidity + Foundry/Anvil for fixtures | V3 deployment path, fee/storage cost, EVM funding and RPC method compatibility must be tested before a live flow is promised. |
| AI | Groq structured output; prefer `openai/gpt-oss-120b`, optional `openai/gpt-oss-20b` fallback | Strict JSON format is not semantic validation. Enforce budget, deadlines, 429 handling and labelled offline curated fallback. |
| CI | GitHub Actions on a standard runner in the public repository | Standard runners are currently free for public repositories; larger runners and some storage usage may not be. Do not use paid options. |
| Runtime | A supported Node LTS compatible with chosen dependencies; pin the exact version and lockfile once tested | Node 24 LTS is a reasonable starting candidate, not a guarantee of dependency compatibility. |

**Why a static-first design:** Public example traces can be a reviewed static JSON artefact bundled during deployment. Private/experimental runs remain local files; there is no first-version server-side run registry. A local-file inspection capability, if added, must parse inert JSON locally under strict byte/event caps; it must never upload or execute the file and is not a custom bridge runner. Public publishing is a builder-controlled release action, not a guest action.

## 6. Local determinism, scheduler and adapter

### Bounded action vocabulary

The initial adapter can describe only supported actions, including `LOCK`, `ISSUE_FILL_PERMIT`, `DELAY_DELIVERY`, `ADVANCE_LOGICAL_TIME`, `REQUEST_REFUND`, `DELIVER_FILL`, and `CLAIM`. These are **conceptual action names**, not existing CLI commands. Each action has a typed, validated payload; addresses and amounts are references to declared fixture actors/assets, never executable text. The adapter is trusted, locally installed code authored by a developer; the browser must not execute arbitrary adapters supplied by strangers.

**Scheduler rules, v1 proposal:**

1. Accept a seed as a canonical unsigned 64-bit decimal string, unique stable action IDs, non-negative logical ticks and an acyclic dependency graph. Reject duplicate IDs, cycles, invalid bounds and undeclared actors/assets before execution.
2. Each dependency explicitly means either “prior action attempted” or “prior action succeeded.” This distinction lets both fixtures receive the **same attempted sequence** even when the patched refund is rejected.
3. On each tick, select only causally ready actions at the earliest eligible logical time. When multiple actions are intentionally unordered, sort them by the lexicographic bytes of SHA-256 over a versioned, unambiguous encoding of `(seed, scenario ID, action ID)`; break a hash tie by action ID. An explicitly chained sequence has no ordering choice, so changing the seed need not change it.
4. Submit one local action at a time; record attempted action, actual result and normalised observation before advancing. Do not use unrecorded randomness, wall-clock time or uncontrolled parallel ordering. Enforce a maximum logical tick and per-action/total execution timeout.
5. Limit initial proposals to at most 5 scenarios and 20 actions per scenario. Version the ordering algorithm and canonical encoding; changing either changes the replay contract. Browser and Node implementations must have shared test vectors.

**Reconstruction requirements:** persist the scenario, seed, scheduler version, actor/asset configuration, local chain IDs, initial logical time and balances, deployed fixture bytecode/constructor parameters and deployment order, relevant EVM settings and fork identifiers if any, dependency/tool versions, adapter version and invariant set. A reusable fixture/state dump must be available where feasible. Record a digest of canonical reconstruction inputs. A temporary local snapshot ID alone is not portable.

**Normalisation:** compare semantic actions, statuses, state and invariant results in stable order. Do not incorporate wall-clock timestamps, transient process IDs, explorer URLs, live public tx hashes, or other uncontrolled fields in the reproducibility comparison. Any inclusion of gas/blocks must be explicitly justified by pinned settings. Record nondeterministic metadata separately. Different toolchain or fixture versions require a new compatibility claim.

### Adapter contract — design, not implemented API

| Capability | Required responsibility |
|---|---|
| Describe | Declare adapter ID/version, actor roles, supported chains/modes, assets, actions and invariants. |
| Initialise | Reconstruct or connect to a specifically allowed test fixture; no mainnet by default. |
| Apply | Convert one validated allowed action into the local fixture call(s), returning attempts, observations and errors. |
| Observe | Read relevant source/destination states, receipts and events, with chain identity and provenance. |
| Assert | Evaluate user-authored invariants over a normalised, explicitly scoped observation. |
| Reset / dispose | Restore or rebuild local initial state and release resources. Public chains are never reverted. |

**Exit semantics:** ordinary CI runs return success only if all required invariants pass; a violation fails CI; invalid configuration, unavailable RPC, timeout or unsupported mode are infrastructure errors and must not be reported as a pass. The reference-demo integration test separately asserts that the intentionally vulnerable fixture fails *and* the patched fixture passes the same bounded case; an absent expected counterexample fails that test.

## 7. Artefact and data design

### Scenario v1 — planning contract

| Field | Proposed constraint |
|---|---|
| `schemaVersion`, `scenarioId`, `title` | Known version; stable ID of at most 64 characters; plain-text title of at most 80 characters. |
| `origin` | Exactly `ai`, `curated`, or `human-authored`; the gateway, not the model, assigns `ai` to accepted model proposals. |
| `seed` | Canonical unsigned 64-bit decimal string; no floating-point conversion. |
| `fixtureId`, `adapterVersion` | Must match an explicitly allowed installed fixture/adapter; a proposal cannot load a new package or address. |
| `actions` | One to 20 unique actions. Each declares an allowed `kind`, fixture actor/asset references, bounded logical tick, explicit dependencies and type-specific values. |
| `hypothesis` | Short untrusted explanation of the suspected failure, not an invariant result. |

Use strict provider-compatible JSON Schema: all object properties required, `additionalProperties: false`, and absent semantic values represented explicitly where the provider requires them. Then validate action types, role permissions, dependency graph, integer ranges, tick/step limits, mode/chain and adapter capabilities independently. A valid structure with impossible or unsupported semantics is rejected. The model cannot choose a raw RPC URL, wallet key, contract address, ABI, executable source or calldata.

### Run artefact v1 — planning schema

**Required groups:**

| Group | Required fields / semantics |
|---|---|
| Identity | schema version; run ID and canonical input digest; display title; source version/commit if known. |
| Provenance | mode (`browser-model`, `local-evm`, `public-testnet`); origin (`ai`, `curated`, or `human-authored`); created time as metadata; publication status. |
| Reproduction | seed, scheduler/adapter/fixture versions, bounded scenario, deterministic environment and reconstruction digest; controlled chain configuration for local runs. |
| Trace | ordered step ID, logical time/sequence, actor, action, attempted/observed outcome, sanitised state delta, and error code when relevant. |
| Results | each invariant ID, `pass` / `violation` / `incomplete`, reason and supporting step IDs; explicit bounds and limitations. |
| Evidence | real chain ID, contract address, transaction hash, receipt status, block number/hash, observed confirmation count, RPC/explorer link if supported, role/signature origin, and observation time. Only for genuine transactions; missing evidence remains absent. |
| Privacy | public/private classification, redaction summary; never secrets, auth tokens, raw wallet keys, or private RPC credentials. |

All token amounts and logical timestamps are decimal strings with explicit units or integer types; do not use floating-point arithmetic for balances. Treat artefact content as untrusted text: strict schema, supported version, byte and event count caps, safe rendering, no HTML execution, no remotely supplied scripts. Use a versioned migration policy; reject unsupported future versions with an actionable error. A hash demonstrates integrity of the chosen bytes, **not** correctness or truth of the trace.

## 8. Authentication, API boundaries and privacy

### Public versus gated

- `Home`, the public run list, a published run's timeline/details, read-only filtering, and legitimate external receipt links are viewable without a wallet. Direct links must not bounce to login.
- `Run reference model`, `Replay`, `Generate scenario`, export/save, and all transactions require Privy authentication **and** a connected external or embedded wallet. The client gate for local actions is a product rule, not an enforceable security boundary against a modified browser.
- Google login may authenticate before a wallet is connected. Present a clear choice: connect an external wallet **or** explicitly create/connect a Privy embedded wallet. Configure automatic embedded-wallet creation off. Wallet/chain/gas status are separate from login status.
- For a paid-resource endpoint, verify the Privy access token server-side using the provider's current documented verification method. Independently confirm the wallet belongs to the authenticated subject and require a short-lived signed, domain-bound, action-scoped challenge; consume its nonce atomically in D1. Verify subject/audience/expiry/issuer and wallet linkage with the correct Privy token type or verified linked-account lookup. A client-supplied address or front-end boolean is not proof.
- For a user-signed testnet action, show chain, actual contract, function, amount, role and risk before asking for signature. Check the chain ID and allowlisted deployed address both when preparing and just before submission; reject mainnet and unknown addresses. Display rejection, pending, receipt failure, wrong network and timeout honestly. Never sign on behalf of the user.
- Operator actions are performed only by the builder's separate local, test-only keys after manual allowlist/approval and a hard spending/transaction cap. There is no public endpoint that gives the browser access to an operator signer. A signed source transaction does not promise that an operator will act.

### Planned API contract (not created)

These paths are proposed interfaces, not currently reachable services. Final names must match the actual implementation and tested documentation.

| Boundary | Access | Responsibility / response |
|---|---|---|
| Published static run artefacts | Public read | Release-reviewed, schema-validated, sanitised files; no private run IDs. |
| `POST /api/wallet-challenges` | Verified Privy session, rate-limited | Verify the requested wallet is linked to the subject; issue a five-minute, one-use challenge bound to subject, wallet, origin, `scenario-proposal` purpose and digest of the proposed request. No signature or key is stored. |
| `POST /api/scenarios` | Verified Privy session + signed challenge, rate-limited | Verify the same subject and linked wallet, signed challenge and request digest; atomically consume the nonce and reserve quota before a bounded Groq request. Return validated candidates plus model/origin metadata; never execute them. |

A proposed response distinguishes invalid input (`400`), missing/invalid authentication (`401`), unlinked wallet or forbidden action (`403`), used/expired challenge or conflicting retry (`409`), quota/provider rate limit (`429`, with safe retry guidance), and provider/state unavailability (`503`). These are target semantics, not an implemented API. A retry must not consume quota twice or invoke Groq twice from the same one-use nonce; if the outcome is unknown, show an honest error and issue a fresh challenge only after checking the prior request state. Bind permitted origins, apply body limits, and do not put a challenge or bearer token in a URL.

No remote execution, arbitrary contract calls, generic RPC proxy, model-controlled transaction endpoint, or server-side key custody is exposed. Use restrictive CORS, body limits, security headers, request timeouts, strict validation and least-privilege secrets. Rate-limit state uses atomic D1 operations, not eventually consistent key-value reads. Log only operational metadata and scrub authentication tokens, private code, Google identifiers, prompt contents and keys. Set an explicit retention/deletion schedule for nonce/counter records.

### AI controls

- Working account-specific model information supplied by the user: each of `openai/gpt-oss-120b` and `openai/gpt-oss-20b` is currently understood to have 30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD. Recheck the actual Groq console; do not assume these limits are permanent or dedicated to Vareq.
- Conservative application defaults: at most 3 proposal calls per verified wallet per day, 60 per application per day, and 3 per application per minute; enforce atomically. Bound prompt/input length and output tokens, monitor provider token usage, stop at caps, and honour `429`/`retry-after`. These limits are lower than the reported request quotas but cannot guarantee token-limit compliance if the organisation is shared.
- Send only a minimal adapter capability description and non-sensitive scenario context by default. No raw private code, keys, wallet signatures or secrets. Explain that Groq receives the submitted context and link to its current data policy; do not promise zero retention.
- Request strict JSON Schema output using the provider-supported structured-output configuration. Validate shape, additional fields, action kinds, actor references, bounds, timing, prerequisites, chains and permissions in our own code. Reject unsafe, nonsensical or unsupported scenarios. Never execute AI-generated source, shell, ABI strings or transaction calldata.
- If Groq is unavailable, offer a clearly labelled **curated offline scenario**. Do not call it AI-generated, silently substitute it, or claim full coverage.

## 9. Testnet configuration and deployment gate

| Network | Confirmed public setting | Still to verify before use |
|---|---|---|
| Base Sepolia | chain ID `84532`; public RPC `https://sepolia.base.org`; ETH test currency; explorer `https://sepolia.basescan.org`. Base separately documents a transaction-submission endpoint. | Faucet eligibility/funding for user and operator, live RPC limits, contract deployment, receipt visibility. |
| Portaldot V3 | event EVM chain ID `420420777`; RPC `https://test-evm-rpc-v3.portaldot.dev`; native node `wss://test-node-v3.portaldot.dev`; node console `https://node-console.portaldot.dev/`. | Funded account mapping, native/EVM units and decimals, storage deposits, EVM bytecode path, supported RPC methods, wallet network metadata, and independently inspectable contract/transaction evidence. |

Official distribution instructions ask for a **native SS58 address beginning with `5`**, not an EVM `0x` address. The owner should confirm with organisers how the funded native account maps or transfers to the specific EVM signer and how to fund a user wallet. Participant reports on bytecode, direct RPC deployment and account mapping conflict and are not an authoritative guarantee. Do not prescribe a currency symbol, decimal conversion, padding rule, gas amount, explorer URL or claimed faucet eligibility without a verified source and live test.

**Deployment spike after approval:** verify chain identity and head; obtain test funds through official instructions; measure a tiny test-only deployment or supported native deployment route; verify a read and an authorised write/receipt; confirm contracts are visible at the expected address; record exact tool/chain settings and actual costs. If the official EVM RPC deployment path fails, ask organisers before inventing a fallback. Do not ship a live chain button or claim Portaldot deployment until the spike succeeds.

## 10. Experience flows

### Public reviewer

1. Open `/` → “Explore a test run” → a published, read-only trace at `/app/runs/:runId`.
2. See mode, origin, completion status and bounds before the timeline.
3. Inspect an event and invariant; follow actual receipt links only when present.
4. No wallet prompt interrupts reading. An unavailable or unpublished run returns an honest not-found/empty state.

### Connected user

1. Select an action → log in with Google or wallet → connect an external wallet or explicitly create/connect an embedded wallet.
2. For a local run, acknowledge that it is the browser reference model; choose the curated preset or a previously validated AI scenario and a seed; run within limits and inspect results.
3. To replay an existing trace, play its recorded events; label as playback, not a transaction or EVM re-execution.
4. For operator-assisted testnet mode, check exact network, token/gas balance, reference asset and contract. User signs their own testnet approval/lock and any refund action. The operator manually selects that transfer, within its budget, and signs its own role transactions; the UI shows only observed receipts. If operator/funds/RPC are unavailable, show an unavailable state and keep the local demo usable.

### Bridge builder

1. Define the adapter capabilities and an invariant for a local fixture.
2. Run a deterministic curated scenario; optionally request validated AI suggestions with explicit consent.
3. Add the test to an existing CI pipeline, retain the artefact on failure, and inspect/replay locally. The local CLI/CI does not require Privy; if AI is enabled there, the developer supplies their own Groq credentials through local environment or CI secrets. The hosted browser gateway never exposes its provider key to the CLI or client.
4. Publish only an intentionally sanitised artefact. Exact package names, install commands and CLI syntax must be finalised and tested before appearing in the product.

## 11. Quality and security acceptance criteria

**Functional:**
- A controlled vulnerable local EVM run reproduces the specified invariant violation at least twice with the same normalised result and reconstruction inputs.
- The patched fixture passes the same attempted sequence under the declared honest-coordinator assumptions; tests include equivocation or compromised-attester as an explicit unsupported/failing condition.
- Browser model and local EVM produce matching semantic outcomes for supported reference scenarios, or disagreements are displayed and block the claim of parity.
- A local CI run succeeds offline with curated scenarios and exits nonzero for unexpected violation or infrastructure failure. A deliberate vulnerable fixture is asserted by a separate expected-failure test.
- An unauthenticated person can read a published run on a direct URL. Gated actions require a connected wallet in the interface; server-paid AI requests independently enforce authentication, wallet proof and budgets.
- A complete live demo is claimed only if the real required transactions, roles and outcomes are recorded. Otherwise show the incomplete state and retain the local demonstration.

**Security and operational:**
- Malformed, overlong, unknown-action, unsupported-chain, out-of-order, duplicate/replayed nonce and prompt-injection inputs are rejected safely.
- No secret or authentication token appears in the bundle, published artefact, log, screenshot, issue, test fixture or repository. All keys are test-only and stored outside git.
- Test evidence distinguishes user signatures, operator signatures, model steps and observed chain receipts. No arbitrary network endpoints, remote code or mainnet signer path is accepted.
- Public artefact rendering avoids unsafe HTML, limits file size/event count and handles unknown schema versions. A malicious trace cannot execute code.
- Accessibility, reduced motion, keyboard operation, narrow screens, loading and error states satisfy `FRONTEND_SPEC.md`.

**Honesty:** No fake testimonials, partner badges, statistics, sample hashes, nonexistent package commands, unperformed audits, guaranteed bug detection or fabricated usage claims. The intentionally vulnerable contracts must be conspicuously labelled test-only in code, deployment metadata, UI and documentation after they exist.

## 12. Alternatives, market and commercial hypotheses

| Adjacent tool | Documented strength / observed overlap | Vareq hypothesis |
|---|---|---|
| Foundry | Free open-source Solidity testing, fuzzing, invariant testing and increasingly capable replay. | Add a bridge-oriented cross-chain scenario/adapter convention and a shared human-readable artefact; use Foundry rather than replace it. |
| Echidna | Free AGPL-licensed property-based smart-contract fuzzing. | Package an asynchronous message-delivery model and bridge-specific workflow; integrations are a later possibility, not implemented. |
| Medusa | Free AGPL-licensed parallel, coverage-guided smart-contract fuzzing. | Explain/replay a particular cross-chain schedule across fixtures; no claim Medusa cannot test these patterns. |
| Certora Prover | Formal verification; its site lists a free basic tier of up to 2,000 runtime minutes/month. | Complement deeper formal methods with a small reproducible scenario and demo workflow, not comparable guarantees. |
| Tenderly | Simulations, debugging and virtual testnet tooling; exact current plan prices and Portaldot support need checking. | Focus narrowly on adapter-backed bridge race evidence; do not assert absent features or unsupported pricing. |
| PortalLink / DotGas | Hacker House participant bridge projects; PortalLink already reports Foundry fuzz and invariant tests, while DotGas explicitly discusses bridge timing. | Evidence of overlap and potential adapter users; neither establishes a novelty claim for Vareq. Verify their present status before citing specific deployments. |

**Customer-discovery hypotheses, not research findings:** bridge teams want a reviewer-readable failure artefact; a small adapter is easier to maintain than a bespoke multi-chain race harness; teams might pay for private retention, shared reviews and policy controls. Validate with 5–10 real bridge engineers after the hackathon; measure adapter setup time, first useful counterexample, CI adoption and evidence sharing. No fabricated customer interviews or market size.

**Potential later business model:** free open-source core; hypothetical hosted team plan around **$79/team/month**, with private run history, access controls and collaboration. This is an unvalidated price, not current availability. At 1,000 Privy monthly active users, Privy's published 500–2,499 MAU tier is currently $299/month; four $79 teams yield $316 before other costs, demonstrating that this toy model is not yet viable. Re-evaluate provider contracts, actual usage, willingness to pay and gross margin before commercial launch.

### Free-build budget and capacity

| Scenario | Planning implication |
|---|---|
| Development / small demo | Target $0 in external services using free-tier Cloudflare, Privy, Groq and public-repository CI, subject to eligibility, quotas, accounts and testnet funding. Device, internet and time are not included. |
| 100 authenticated users | Potentially within Privy's 0–499 MAU tier if signature/transaction-volume and other service quotas are also respected; application AI caps can make requests unavailable. This is not a capacity or SLA guarantee. |
| 1,000 authenticated monthly users | Outside the listed Privy free MAU tier. Do **not** enable a paid tier or automatic spend during this build. Limit/close signups or change architecture only with owner approval. Current published paid price is an illustration, not a required purchase. |

Free services can change, require verification, or throttle. Add monitoring and manual kill switches; do not assume provider access or free test tokens are guaranteed.

## 13. Delivery and sources

The implementation sequence, deadlines, risk gates and verification plan are in `BUILD_GUIDE.md`; evidence and submission checklist are in `SUBMISSION_CHECKLIST.md`; dated links and unresolved assumptions are in `RESEARCH_AND_DECISIONS.md`.

**Approval state:** The owner has since explicitly authorized implementation, GitHub push and Vercel deployment. Live public-chain transactions remain gated on verified testnet support and a user-confirmed wallet signature; do not use personal keys or fabricate receipts.
