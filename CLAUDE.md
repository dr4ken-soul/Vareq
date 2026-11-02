# Vareq — Project Working Rules

> **Current approval state: PLANNING ONLY.** The owner has not authorised project implementation. Do not create source code, package manifests, runnable migrations, workflows, contracts, deployments, or transactions until the owner explicitly approves. Reading/revising the planning documents is allowed. When approval is given, record the decision and its scope accurately; never infer approval from this file's existence.

These rules guide future contributors/agents and do not override newer explicit owner instructions or higher-priority instructions. Start by reading `APP_BLUEPRINT.md`, `FRONTEND_SPEC.md`, `BUILD_GUIDE.md`, `SUBMISSION_CHECKLIST.md`, and `RESEARCH_AND_DECISIONS.md`. Inspect what actually exists; a planned component, command, result or deployment is not evidence it exists.

## Product in one paragraph

Vareq is an open-source-first bridge-testing SDK/CLI and CI workflow with a public run inspector. Groq may propose bounded scenario **data**; a developer-authored adapter and a deterministic local scheduler explore allowed event orderings; invariants and versioned artefacts expose what occurred. The reference case demonstrates an intentionally vulnerable refund/fill race and a mitigation that depends on a trusted non-equivocating coordinator. The public-testnet demonstration targets Base Sepolia → Portaldot V3 using separate user and operator/attester signatures. This is not a production bridge, an audit, a formal proof or a promise to find all vulnerabilities.

## Non-negotiable truth and provenance

1. Distinguish **browser reference model**, **controlled local EVM execution**, and **observed public-testnet transactions** everywhere. Browser playback is not EVM execution. Public testnet playback is not a new transaction or guaranteed identical replay.
2. Deterministic replay is scoped to pinned local state, fixture, tool versions, seed, logical clock, action ordering and other recorded inputs. A temporary snapshot ID is not a portable reconstruction recipe. Public chains can delay, reorder, reorganise or omit transactions; do not claim atomicity or guaranteed finality.
3. No fake metrics, real-sounding sample hashes, invented users/partners/testimonials, unsupported safety/novelty claims, unrun tests, fictitious install commands or placeholder receipts. Label hero trace `Illustrative trace`. `Pending`, `Incomplete`, and `Violation` are not `Passed`.
4. If a public testnet sequence fails, times out or cannot be completed, show its actual evidence and limitations. Do not stitch unrelated runs together to imitate the desired result.
5. Clearly label all vulnerable fixtures and deployed demo contracts as intentionally unsafe, test-only and unsuitable for real assets. All synthetic token comparisons are explicitly test-unit assumptions.

## Access, wallets and signers

- Published runs and read-only navigation/inspection are public. Never add a blanket wallet gate or login redirect to public routes.
- Browser actions—run reference model, recorded replay, AI proposal, save/export and transactions—require Privy authentication plus a connected wallet. Google login alone is not wallet connection. The user chooses an existing external wallet or explicitly creates/connects a Privy embedded wallet; automatic creation is off.
- For server resources, the client-side gate is not security. Verify the current Privy access token, verify wallet linkage using the appropriate identity data, and validate a domain/action/subject-bound signed challenge with a short expiry and atomically consumed nonce. Enforce quotas independently on the server.
- Users sign their own testnet actions; operator/attester keys are separate, test-only, manually approved and strictly budgeted. Never ask for a user's private key, put an operator key in a browser, or let an AI agent sign. Do not expose arbitrary transaction relaying or a generic RPC proxy.
- Verify exact testnet chain ID, allowlisted deployed contract, function, amount, role and wallet before any signature. No mainnet route, real assets, silent transactions or automatic retries after an uncertain receipt. User consent is necessary but does not guarantee operator action.

## AI safety and privacy

- Groq structured JSON is an untrusted proposal, not executable code or a correctness guarantee. Use a narrow allowlisted vocabulary, strict schema and separate semantic validation of actors, assets, timing, prerequisites, chains and bounds.
- Never execute generated source, shell commands, dynamic imports, arbitrary ABI strings or calldata. Never let AI alone determine a pass, move money or change the operator's permissions.
- Keep Groq/Privy secrets and signer keys out of frontend bundles, git, logs, prompts, public traces, screenshots and support messages. Only send minimal non-sensitive context to the provider, and disclose that processing. Do not claim zero data retention without confirmation.
- Enforce the blueprint's per-wallet/global limits, atomic D1 counters, timeouts and 429 handling. If unavailable, offer a **labelled curated offline scenario**, never a silently fabricated AI output.

## Deterministic harness and reference model

- Use developer-authored, locally installed adapters; never execute arbitrary web-uploaded adapters. Validate scenario shape, semantics and maximum length before execution.
- Pin/reconstruct local initial state, fixture bytecode/deployment order, actor addresses/balances, scheduler version, seed, logical time, chain settings and relevant tool versions. Keep nondeterministic metadata outside the canonical comparison.
- Model the exact attempted sequence in the blueprint. The vulnerable result is an expected failure in the special demo test; a missing expected vulnerability fails that test. Standard CI must fail on an unexpected invariant violation **and** on infrastructure errors.
- Compare browser reference-model outcomes with the local EVM fixture for supported scenarios before claiming parity. Record which actions and bounds were tested. A passing bounded test is not a safety proof.
- Patched safety assumes a coordinator that durably records one decision per transfer, never equivocates, enforces domain-separated permits/nonces, and follows an explicit receipt/confirmation policy. Call out the loss of liveness, censorship and compromise risks. Do not describe the coordinator as trustless.

## Design lock

All seven gates are confirmed; do not reopen them without an owner request:
- Operational bento, asymmetric editorial hero, B3 active underline, static background, subtle replayable reveals with reduced-motion alternative.
- Bricolage Grotesque / Source Sans 3 / DM Mono; Mist + burnt orange tokens and detailed classes are in `FRONTEND_SPEC.md`.
- Hero copy: “Expose bridge races before deployment.” / “AI proposes attack scenarios. Deterministic tests explore event orderings and replay failures for inspection.” CTAs: “Explore a test run” and “See how it works.”
- Eight sections in approved order. No brand symbol, hardcoded logo, fake partner mark or decorative crypto logo; ask first if a mark is genuinely needed.
- Generate/review one horizontal reference comp per landing section before coding that page. They are design references, not product screenshots or evidence. Follow the actual text and exact classes in the spec if generated comp text differs.
- Respect accessibility, contrast, keyboard focus, 320px layout, reduced motion, every state, provenance badges and public read-only access.

## Proposed architecture and operations

- Static-first React/Vite/TypeScript/Tailwind frontend, Cloudflare Pages free static hosting, a tightly restricted Pages Function and D1 for short-lived challenges/counters, Solidity/Foundry/Anvil for local fixtures, viem, Privy, Groq and standard-runner public GitHub CI. These are proposals until dependency/runtime compatibility is validated.
- Base Sepolia: chain ID 84532 and RPC `https://sepolia.base.org`. Portaldot V3: chain ID 420420777 and EVM RPC `https://test-evm-rpc-v3.portaldot.dev`; native node `wss://test-node-v3.portaldot.dev`. Verify live identity, funding, method support, gas/storage, wallet chain metadata and account mapping before use.
- Official V3 token distribution requests a native SS58 address beginning `5`, not an EVM `0x` address. Do not guess conversion/decimals or assume participant reports are authoritative. Never publish or request private keys.
- Use only free services during the build. Monitor actual Cloudflare, Groq, Privy and GitHub quotas; no paid upgrade, paid domain, paid runner or automatic billing without explicit owner permission. Account access and test tokens are not guaranteed.
- Keep public artefacts sanitised and deliberately published. Do not create a private-run backend by accident. Render untrusted trace text safely and reject oversized/unsupported files.

## Delivery discipline

- After approval, work in small verifiable stages in `BUILD_GUIDE.md`; test each boundary before building on it. Update documentation with observed facts, not aspirations. Document real commands only after testing them.
- The owner did not submit the Oct 24 check-in; ask organisers whether late participation is allowed. The event page exposes an apparent 03:00 versus 04:00 UTC deadline discrepancy on Nov 6; confirm and use the earlier time until resolved.
- Event rules require a public repo, at least 3 real valid commits during the event, sustained work, testnet deployment evidence, runnable demo, README, ≤3-minute video and pitch deck. Complete/commit the core before the last-24-hour window; do not falsify history.
- Do not claim event eligibility, success, audit, deployment, an integrated service or a verified outcome until independently established. When blocked, report exactly what was and was not done.

## Default verification checklist after implementation exists

- Local vulnerable case produces the expected safety violation; patched case passes the same bounded attempted sequence only under stated assumptions.
- Reconstructed local runs have matching normalised traces; browser-model parity is verified; CI is usable offline and reports infrastructure errors distinctly.
- Public run page loads logged out; protected action is gated; server rejects invalid tokens, unlinked wallets, replayed nonces and abuse.
- Groq proposals are validated; no arbitrary code/network/signing; explicit curated fallback works.
- Actual user/operator testnet signatures and receipts are separately attributed; wrong chain/mainnet is blocked; failures and reorgs are honestly displayed.
- Accessibility, responsive layout, empty/loading/error states and secret scan pass; every link, command and public claim is real.
