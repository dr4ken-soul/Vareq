# Vareq — Build Guide

**Status:** planning only. Do not write, build, publish or deploy Vareq code until the owner explicitly approves.  
**Authoritative companions:** `APP_BLUEPRINT.md` for product/security; `FRONTEND_SPEC.md` for visual and interaction detail; `CLAUDE.md` for working rules; `SUBMISSION_CHECKLIST.md` for evidence and event requirements.

## 1. First decisions and real-world blockers

### Before coding

1. **Confirm event eligibility.** The owner did not submit the 24 October check-in. Ask organisers whether a late entry/check-in is acceptable; do not assume either acceptance or disqualification. Official Discord: https://discord.gg/portaldot.
2. **Clarify the deadline discrepancy.** The official detail schedule says **6 Nov, 04:00 UTC / 05:00 WAT**. The page header says **5 Nov, 23:00 UTC−4**, equivalent to **6 Nov, 03:00 UTC / 04:00 WAT**. Confirm which governs. Plan for the earlier time in the meantime.
3. **Request V3 test funds and clarify account mapping.** The official distribution instructions request a native SS58 address starting with `5`, not an EVM `0x` address. Confirm how the actual EVM signer is funded, token units/decimals, any storage deposit, supported deployment route and receipt lookup. Never send a seed phrase or private key to anyone.
4. **Verify free accounts and quotas.** Create or inspect the owner's Cloudflare, Privy, Groq and GitHub accounts directly; no account is connected here. Confirm Google OAuth/Privy settings, Groq model access/rate limits, free-tier caps and billing kill switches. Do not enable automatic paid upgrades.
5. **Clear names before public release.** `github.com/vareq` already exists. Choose another available repository/organisation handle, and independently check domain, package and trademark availability. No clearance is implied by this plan.
6. **Get explicit approval** of these planning files before implementation. This is a hard stop, not an implied approval.

**Time-sensitive rule:** the event requires genuine sustained development and says core module final versions must not be committed all at once in the last 24 hours before the final deadline. Using the earlier possible deadline, that 24-hour window begins **5 Nov, 03:00 UTC / 04:00 WAT**. Target a complete, genuinely committed core by **4 Nov, 18:00 UTC / 19:00 WAT**. Make at least three substantive event-period commits over time; never fabricate dates or commit history. If timing slips, ask organisers how the rule applies.

## 2. What will be built after approval

### High-level components

1. **Core library:** scenario schema, semantic validation, seeded scheduler, deterministic trace writer, invariant evaluation and adapter contract.
2. **Reference fixtures:** local vulnerable and trusted-coordinator-patched Solidity fixtures with Foundry tests; test-only roles and no production configuration.
3. **Browser reference model:** a small deterministic, bounded, non-EVM model in a Web Worker. It shares the scenario vocabulary and is parity-tested against the local EVM reference for supported cases.
4. **CLI + CI integration:** local adapter execution, curated offline scenarios, reproducible artefacts, clear exit codes, expected-vulnerability integration test and a standard public-repository CI runner.
5. **Public inspector:** static landing page, run list and detail routes; true public read access; Privy Google/wallet login and external-or-embedded wallet choice for actions.
6. **AI gateway:** limited Cloudflare Pages Function with server-side Privy verification, linked-wallet challenge, durable nonce/counters and validated Groq structured output.
7. **Live evidence path:** Base Sepolia source and Portaldot V3 destination test contracts, small test-only funds, separately signed user/operator/attester actions and honest receipt recording. A human operator must approve live demo activity.

### Future repository layout — names are proposals, not existing files

```text
vareq/                              proposed repository root
  apps/
    web/                            public UI + browser reference model
    gateway/                        scenario gateway and wallet-proof boundary
  packages/
    core/                           types, schema, scheduler, invariants, artefacts
    reference-adapter/              supported local fixture adapter
    cli/                            local commands and exit behaviour
  contracts/
    reference/                      intentionally vulnerable + patched test fixtures
    tests/                          Foundry/unit/invariant tests
  scenarios/                        versioned, curated non-secret scenario data
  evidence/                         release-reviewed public evidence only
  docs/                             adapter, threat model, provenance and runbook
  .github/workflows/                standard-runner CI workflow
  FRONTEND_SPEC.md / APP_BLUEPRINT.md / CLAUDE.md / BUILD_GUIDE.md
```

Do not create this tree until approved. Exact packages, dependencies, CLI syntax and repository handle are not final; do not show hypothetical install commands as working commands.

## 3. Phase gates and detailed implementation sequence

### Gate A — compatibility and cost spike

**Goal:** eliminate the biggest V3 and provider risks before the entire live product depends on them.

- Record official network identity: Base Sepolia chain ID `84532` and Portaldot V3 EVM chain ID `420420777`. Verify the RPC-reported chain ID and current head, not merely the UI label.
- Obtain real V3 and Base test funds through approved free channels. In a throwaway test-only account, verify a minimal authorised read/write and tiny contract deployment on V3, using the actually supported route. Measure fees/storage requirements rather than copying participant claims.
- Record network metadata, currency representation, account mapping, RPC method support, contract address, transaction hash and receipt; explicitly state if explorer evidence is unavailable.
- Confirm that Privy supports the chosen Google/external/embedded flow on the target app and that a wallet linked after Google is recognised. Automatic embedded creation remains off.
- Spike access-token verification and a linked-wallet signed challenge inside the Cloudflare Pages Function runtime. Check the 10 ms free CPU budget, dependency compatibility and D1 atomic nonce operation. If not viable, redesign or disable the server AI action; never ship a client-only fake check or move the API key to the browser.
- Confirm Groq structured output on at least one of the user's allowed models. Validate schema and bounded semantics locally. Confirm account console rate limits and provider privacy terms.

**Pass:** actual minimal V3 transaction/deployment and required account path work, or the V3 integration is explicitly marked blocked with organiser escalation. No unsupported method/funding assumption is allowed to masquerade as a pass. The official event requires Portaldot testnet deployment, so a local-only fallback is a useful prototype but does **not** satisfy that requirement.

### Gate B — deterministic reference fixture

- Define two isolated local EVM fixtures, actor addresses, balances, source/destination test assets, token-unit assumptions, clock, scheduler version, fixed seed and action list. Reject mainnet IDs by default.
- Implement vulnerable source refund, destination fill and source claim behaviour strictly as an educational test fixture. Clearly label it unsafe.
- Implement the patched comparison with one trusted coordinator: a persisted fill/refund decision before signing, no conflicting permit per transfer, domain-separated signatures/nonces, an attested destination receipt for claim, and explicit lack of production-grade liveness/finality.
- Run the fixed attempted sequence: lock → issue fill permit / hold delivery → advance logical time → request refund → deliver fill → claim. The vulnerable fixture should end with the safety invariant violated and claim unreimbursed; the patched fixture should reject conflicting refund authorisation and, under its honest-attester assumptions, permit fill and reimbursement.
- Test invalid signatures, permit replay, wrong role, duplicate IDs, missing permit, coordinator unavailability and a deliberately equivocating/compromised coordinator as a documented failure of assumptions. Do not claim compromised-coordinator safety.
- Define trace normalisation and persist reconstruction inputs; an in-memory Anvil snapshot ID is not portable. Repeat a local run from a reconstructed initial state and compare semantic traces.

**Pass:** the expected counterexample and expected mitigation outcome are actually observed; a missing expected counterexample is an integration-test failure. Distinguish in-flight status from terminal loss.

### Gate C — SDK, CLI, CI and artefacts

- Implement the developer-authored adapter interface: describe, initialise, apply validated action, observe, assert, reset/dispose. Only supported action types and fixture actors/assets may be referenced.
- Implement bounded scheduling: fixed logical time, stable IDs and ready-queue ordering, versioned seed algorithm, serial local actions, explicit per-action/total timeouts, reproducible initial conditions.
- Validate all scenario fields before execution. Reject unknown fields/actions, unsupported chain IDs, invalid references, impossible bounds, malformed amounts and unreachable prerequisites.
- Record versioned artefacts with provenance, scenario origin, reconstruction digest, semantic trace, invariant result and evidence. Amounts use explicit integer/decimal-string units; never floating-point balance arithmetic.
- Make ordinary CI fail on invariant violations or infrastructure errors. Use a separate positive test that expects the intentionally vulnerable fixture to fail and the patched fixture to pass. A timeout is **not** a security pass.
- CI should work without network access or a Groq key using curated scenarios. Retain a bounded sanitised artefact for debugging. Exact install/run commands must be written only after the actual CLI exists and has been tested.
- Create a minimal second adapter/example or adapter contract test to show the boundary is reusable; do not claim plug-and-play support for arbitrary real bridges without proving it.

**Pass:** same input + pinned fixture + scheduler/tool versions reproduces the same normalised trace; the artefact is safe to parse; failure paths exit nonzero; CI succeeds offline for the baseline test.

### Gate D — model parity and public inspector

- Build the approved static landing page and inspector only **after producing and reviewing one horizontal visual reference per each of the eight sections**. These comps are planning references, not live screenshots; exact text in `FRONTEND_SPEC.md` wins over generated image text.
- Implement the browser reference model in a Web Worker with the same bounded action vocabulary and deterministic scheduler rules. It does not run EVM contracts. Verify semantic parity with local EVM traces for the reference scenarios; expose differences rather than masking them.
- Publish only release-reviewed/sanitised static artefacts. The public run list and direct run URLs load without authentication, including during auth hydration. An empty artefact set has the honest empty state in the spec.
- Gate browser-run, recorded replay, AI proposal, save/export and transactions on Privy authentication plus a connected wallet. Read-only event selection and filtering remain public. Client gating alone is not a server security boundary.
- Offer Google and wallet login; after Google, let the user choose an external wallet or explicitly create/connect an embedded wallet. No automatic embedded-wallet creation. Separately show wrong network and insufficient testnet funding.
- Implement recorded trace playback, not simulated receipt creation. Show `Local reference model`, `Local EVM execution`, or `Observed testnet transactions` and origin on every run.
- Test 320/360/768/1024/1280/1440px, keyboard navigation, focus restoration, 200% zoom, screen reader, reduced motion, failure/loading/empty/wrong-network states and malicious artefact text. No visual stats or partner marks without evidence.

**Pass:** a new unauthenticated browser can open a real published run directly, inspect it, and never sees a mandatory login until choosing an action; a Google-authenticated user without a wallet cannot run a gated action.

### Gate E — restricted AI gateway

- Keep `GROQ_API_KEY`, Privy secrets and any operator keys on the appropriate server/operator environment, never the browser or repository. The Privy public app identifier can be client configuration; it is not an authentication proof.
- Verify the actual Privy access token using current official documentation. Verify linked-wallet identity using the correct identity-token/verified-user method; bind a short-lived signed challenge to authenticated subject, wallet, domain, permitted action and expiry. Consume the nonce atomically once in D1; reject repeats.
- Enforce small server-side body, action, scenario, runtime and token bounds. Default limits: 3 AI proposals/wallet/day, 60/app/day and 3/app/minute. Treat these as operational settings, not provider guarantees. Use atomic D1 counters; fail closed if state cannot be checked.
- Submit only minimal non-sensitive capability data to Groq. Request supported structured output, then perform independent schema and semantic validation. Never execute model code, arbitrary transactions or dynamic imports. Honour `429`/`retry-after` and show an explicitly curated offline fallback.
- Avoid storing prompts, JWTs, Google identities, wallet signatures, private code or keys in logs. Retain only necessary short-lived nonce/counter metadata, with documented deletion.

**Pass:** forged/expired tokens, an unlinked wallet, replayed nonce, rate abuse, unsupported actions and malicious model data are rejected; a valid authorised proposal succeeds or fails transparently without affecting public reads.

### Gate F — genuine two-network evidence

- Configure **Base Sepolia as source** and **Portaldot V3 as destination** only after Gate A establishes support. Use verified testnet chain IDs, verified contract addresses, tiny valueless reference assets and explicit role budgets.
- The connected user signs their own source operations. The operator and attester use separately controlled test-only keys, manual transfer approval and hard daily/transaction caps; no browser/server endpoint exposes operator key control. The user may need separate approve/lock or refund signatures and real testnet gas/tokens.
- Observe and record each transaction independently: chain, role, function, hash, actual receipt status, block/hash, observed confirmations and real explorer/console reference if available. Do not assume a submitted tx is included or final.
- For the live race, record what actually happens. If a transaction is delayed, dropped, reverted or reorged, display `Incomplete` or the observed outcome. Do not force a positive narrative by stitching unrelated runs together.
- Model/Anvil results and testnet integration receipts remain separate evidence types. An actual testnet execution is not guaranteed to reproduce the local ordering or outcome.
- Sanitize evidence before release: no private RPC credentials, personal identifiers, private code, auth tokens, keys or unrelated wallet data. Public addresses and tx hashes are public chain data; disclose that fact.

**Pass:** real V3 deployment and interaction evidence is independently inspectable and labelled; the event's testnet requirement is not checked off until actually satisfied. If the full race is incomplete, present honest integration evidence plus the separate local counterexample.

## 4. Suggested solo schedule and milestones

This is an ambitious target, not a guarantee. Start dates assume explicit approval and eligibility confirmation; adjust immediately if either is delayed.

| Target, UTC (WAT = UTC+1) | Outcome / real commit milestone |
|---|---|
| **30 Oct evening / 31 Oct** | Contact organisers on eligibility, deadline and V3 funding. After approval, establish repo and access; run Gate A. Commit substantive setup/spike work as it actually happens. |
| **31 Oct–1 Nov** | Build deterministic reference fixture and failing/passing paired scenario. Commit contracts, local tests and trace model incrementally. |
| **2 Nov** | SDK/adapter, reproducible artefacts and offline CI; commit working core and test evidence. Start narrow Groq gateway spike. |
| **3 Nov** | Produce/review eight section reference comps, then landing page and inspector; implement Google + wallet flow and local browser model. Commit real progress. |
| **4 Nov, by 18:00 UTC / 19:00 WAT** | Complete core modules, model/EVM parity, security checks and real testnet integration if available. Commit final core work before the last-24-hour window. Record actual deploy and interaction evidence. |
| **5 Nov** | Final README, evidence review, independently accessible demo, ≤3-minute video, deck and submission; aim to submit by **18:00 UTC / 19:00 WAT**. Fix only as allowed by event rules; do not conceal timing. |
| **6 Nov, 03:00 UTC / 04:00 WAT** | Conservative possible deadline/code-freeze boundary. Organiser confirmation may clarify whether 04:00 UTC is controlling; do not rely on the later time without confirmation. |

If scope slips, preserve in order: (1) real Portaldot deployment evidence, (2) deterministic vulnerable/patch case with honest assumptions, (3) offline SDK/CI and public inspector, (4) gated bounded AI, (5) visual polish. Do not cut security, provenance, public read access or the distinction between model and chain evidence.

## 5. Test plan

| Layer | Essential tests |
|---|---|
| Contract/unit | Owner/role controls; permitted transitions; both-outcome safety assertion; replay protection; wrong signature/chain/contract/nonce; safe failure on unavailable/compromised coordinator. |
| Scheduler | Fixed seed and same initial state → same semantic order; time advances deterministic; stable tie-breaking; unsupported action/prerequisite rejected; bounds/timeouts enforced. |
| Reproduction | Rebuild local fixture from recorded inputs; compare normalised traces twice; version mismatch detected; snapshot ID alone not accepted as a portable artefact. |
| Adapter/CLI | Contract test for supported actions; expected vulnerable violation is caught; patched passes only within assumptions; any infrastructure error is nonzero; offline CI works. |
| Browser model | Fixture parity for supported scenarios; worker timeout/cancellation; no EVM or testnet execution claims; malformed action rejected. |
| AI | Strict schema plus semantic checks; wrong actor/chain/action, excessive steps, unexpected fields and prompt injection fail safely; quotas and 429 tested; fallback explicitly curated. |
| Authentication | Public route accessible logged out; Google without wallet gated; valid external/embedded wallet works; invalid Privy token, unlinked wallet, expired or reused nonce and forged client flag fail at server boundary. |
| Testnet | Wrong chain/address blocked; user consent visible; no mainnet route; each signer is separate; receipt timeout/reorg handled; operator caps enforced; no fabricated receipt. |
| Frontend | Accessibility, responsive sizes, no horizontal body scroll, reduced motion, wallet rejection, pending/failed/offline/empty/unsupported artefact states, safe text rendering and direct-link SPA fallback. |
| Release | Scan bundle, repo, logs and artefacts for secrets; verify every public link/claim/hash; compare README steps to a clean environment; inspect video/deck against real evidence. |

## 6. Operational controls and free-tier limits

- **Cloudflare:** static assets are free under the current Pages pricing; Pages Functions count against Workers free usage. The current free plan lists 100,000 requests/day and 10 ms CPU per invocation. D1 free limits include 5 million rows read/day and 100,000 rows written/day; check plan details and 500 MB per-database free size. Request counts/limits are shared as documented and subject to change.
- **Privy:** current public pricing lists a free Developer tier for 0–499 MAU, 50,000 monthly signatures and $1M transaction volume as stated. Monitor usage and do not opt into paid tiers during the build. Google authentication and wallet signatures may have separate practical limits.
- **Groq:** user's reported model quotas are account-specific and can change; use the application caps in the blueprint and inspect rate headers. 429 must be handled, not hidden.
- **GitHub:** standard hosted runners for a public repository are currently free; avoid larger runners and monitor artifact/cache storage. Follow each provider's current terms.
- **Testnets:** free test tokens are not guaranteed; rates, faucet eligibility and chain availability can fail. No real funds and no mainnet. Never grant a model or an unauthenticated guest access to a signer.

Provide owner-controlled switches to disable AI calls, new live demos and outbound operator activity without disabling public reading. Free tiers may throttle or change; a zero-cost plan is conditional rather than a promise of unlimited service.

## 7. Definition of done and submission

1. All Gate A–F evidence is either genuinely passed or plainly reported blocked/incomplete; no false claims.
2. Public repository is accessible, has the required real commit history, tested setup and an honest README with architecture, limitations, dependencies, deployment info and reproducible local instructions.
3. Testnet contract/address/hash evidence is real and linked where independently inspectable; the demo and public run viewer work on a clean browser.
4. A ≤3-minute video shows a real product, its local counterexample/mitigation, the clear trust boundary and genuine Portaldot integration. It does not represent illustrations as results.
5. A deck explains problem, product, why Portaldot matters, proof, limitations and follow-on plan. No fabricated users/revenue/results.
6. Submit the event form early, before the conservative deadline. Confirm any late eligibility issue directly with organisers. After code freeze, follow event rules and report any serious necessary fix.

**Current state (2 Nov 2026):** The repository, public web app, local reference model, CLI, Solidity teaching fixtures and pitch deck exist. Vercel API routes now provide a disabled-by-default Privy/Groq proposal gateway and read-only receipt verification; those routes still need credentials, shared storage and live RPC verification. No Base Sepolia or Portaldot V3 demo contract or receipt is published. The timed submission video and final DoraHacks submission remain open.
