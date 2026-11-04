# Vareq — Research, Decisions and Open Questions

**Research snapshot:** 30 October 2026. Provider terms, network behaviour and event details may change. This file records sources and planning judgments; it is not a claim that accounts, contracts, transactions, services or results have been verified in the owner's environment.

## 1. Decisions already confirmed with the owner

| Topic | Decision |
|---|---|
| Product/name | Vareq; an AI-assisted bridge-testing SDK/CLI and CI workflow with a browser inspector. |
| Owner profile | Solo, experienced, mostly full-time; comfortable with TypeScript, Solidity and Foundry. |
| Commercial direction | Open-source core first; hosted commercial service may be explored later. |
| Services | Free external services during the build; Groq for AI; Privy for identity/wallet access. |
| Identity | Google **and** wallet login; users may choose an existing external wallet or explicitly create/connect a Privy embedded wallet. Google alone is not a connected wallet. |
| Access | Published runs publicly viewable; connected wallet required for actions. User signs their own testnet role; distinct controlled test-only signers handle other roles. |
| Inspector scope | Owner delegated the initial action choice: bounded predefined reference-model run, recorded playback and optional validated AI proposal; custom bridge integration via SDK/CI. No arbitrary remote code. |
| Design | Seven gates completed. Operational bento, B3 underline navigation, static background and restrained replayable reveals, approved fonts and palette, trace-first asymmetric hero, approved eight-section order. See `FRONTEND_SPEC.md`. |
| Approval | Planning documents only so far. **No implementation code or deployment until explicit owner approval.** |
| Marks | Do not use hardcoded logos or brand symbols; ask first if a mark is required. |

## 2. Architecture choices made in this plan

These are design recommendations within the delegated scope, not claims that technology has been tested.

- **Execution modes:** browser reference model for bounded interactive use; separate local EVM harness for reproducible contract-level evidence; separate public-testnet transaction observation. Visual playback of a recording is not a new EVM or chain execution.
- **Live direction:** Base Sepolia source → Portaldot V3 destination, subject to actual V3 compatibility/funding. User signs source role; a manually controlled test-only operator and attester perform their own limited roles. No autonomous publicly available operator wallet.
- **Reference mitigation:** one trusted coordinator issues mutually exclusive fill/refund decisions and attests destination evidence according to a stated policy. It is a deliberately limited teaching model, not a decentralised oracle, audited bridge or liveness guarantee.
- **Privacy/data:** static published reviewed run artefacts; private runs stay local; a minimal D1-backed challenge/rate-limit store is proposed for the Groq gateway. No public arbitrary job runner or trace upload/execution service.
- **Frontend hosting:** React/Vite on Cloudflare Pages, with a small Pages Function if runtime/auth compatibility fits the free tier. A failed compatibility spike blocks or redesigns the AI endpoint; it does not justify leaking the Groq key.
- **AI:** prefer `openai/gpt-oss-120b`, fall back to `openai/gpt-oss-20b` when available; strict JSON output plus independent semantic validation; explicitly labelled curated offline fallback.
- **Budget:** target zero external-service spend during the build. Free accounts, quotas, verification and test funds are conditional; no paid upgrade without owner permission.

## 3. Verified event information and uncertainty

The official event detail page https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail states:

- Check-in deadline: 24 Oct 2026, 12:00 UTC. The owner has said they did not submit it. The effect on eligibility is **unknown**; ask organisers.
- Detailed final submission/code freeze: 6 Nov 2026, 04:00 UTC. The same page header shows 5 Nov, 23:00 in UTC−4, which converts to **6 Nov, 03:00 UTC**. These differ by one hour. Confirm the governing deadline; plan for the earlier one.
- A public repository, at least 3 valid event-period commits, sustained development, runnable final work, README, demo video ≤3 minutes, pitch deck and Portaldot testnet deployment/evidence are required or specified in the final material. The event also constrains late core-module commits and post-freeze changes.
- Weights: technical feasibility 30%, innovation 30%, ecosystem contribution 20%, business potential 20%.
- Official network info: node `wss://test-node-v3.portaldot.dev`, EVM RPC `https://test-evm-rpc-v3.portaldot.dev`, EVM chain ID `420420777`, node console `https://node-console.portaldot.dev/`. Token distribution requests the participant's native SS58 address starting with `5`, not their EVM `0x` address.

The official track page https://dorahacks.io/hackathon/portaldot-hacker-house-2026/tracks describes Multi-Chain & Cross-Chain Infra as concerned with interoperability, secure bridge mechanisms and liquidity solutions. That makes it the strongest proposed fit, not a guarantee of track acceptance or reward.

## 4. Networks and implementation risks

### Base Sepolia

Official Base documentation lists chain ID `84532`, read/general RPC `https://sepolia.base.org`, test currency ETH, explorer `https://sepolia.basescan.org`, and a separate transaction-submission endpoint. See [1](https://docs.base.org/base-chain/quickstart/connecting-to-base). Faucet eligibility, funding, service availability and exact rate limits remain to be verified.

### Portaldot V3

The event's official EVM endpoint and chain ID are above. The event describes V3 as EVM-compatible, but that statement alone does not prove that the planned deployment tool, every EVM RPC method, account mapping, decimal conversion, storage economics or wallet metadata behaves as needed.

Participant reports illustrate uncertainty rather than resolve it:
- https://github.com/Rohitamalraj/DotProof reports a direct EVM-bytecode deployment path and specific account/currency observations.
- https://github.com/Suganthan96/Potake describes deployment via a native `revive` extrinsic rather than ordinary `eth_sendRawTransaction`.

Those are participant statements, may reflect different methods or dates, and are not authoritative network specifications. Test with a funded isolated test signer and ask organisers. Do not copy their reported padding, symbols, decimals, costs or tx paths as facts without independent verification.

**Native V3 check on 4 Nov 2026:** connecting to `wss://test-node-v3.portaldot.dev` returned chain `PortaldotV3 Test`, runtime `portaldot-v3` spec version `3002`, SS58 format `42`, and native token `tPOT` with 14 decimals. Runtime metadata exposes `system.remarkWithEvent`, `balances`, `contracts` (including `instantiateWithCode`/`call`) and `revive` calls. This confirms that the native RPC and those call definitions are exposed; it does **not** prove a native contract can be deployed or called successfully. The supplied SS58 wallet showed zero free native balance at the sampled head, so it could not pay for a native write at that check. No transaction was broadcast.

### Local versus live replay

Foundry's Anvil documents local snapshots, time setting and mining controls [1](https://getfoundry.sh/anvil/reference/). These tools enable controlled local experiments; they do not control independent public-chain inclusion or finality. Anvil snapshot IDs are session-specific: portable reproduction requires reconstructible fixture inputs and pinned versions.

## 5. Provider and cost findings

| Service | Public/user-provided information as of snapshot | Planning implication |
|---|---|---|
| Cloudflare Pages + Functions | Static-asset requests are free/unlimited under the documented pricing; Functions requests count against Workers free quotas. [1](https://developers.cloudflare.com/pages/functions/pricing/) | Use static public artefacts; protect and limit dynamic requests. |
| Workers Free | Current official limits list 100,000 requests/day and 10 ms CPU per invocation. [2](https://developers.cloudflare.com/workers/platform/limits/) | Small gateway may fit but runtime/JWT/DB compatibility and actual CPU must be measured. The daily quota is shared as documented. |
| Cloudflare D1 | Official pricing lists 5 million rows read/day, 100,000 rows written/day and 5 GB aggregate free storage; limits list 500 MB per free database. [2](https://developers.cloudflare.com/d1/platform/pricing/index.md), [1](https://developers.cloudflare.com/d1/platform/limits/) | Short-lived nonce and atomic counters only. Fail closed if unavailable; do not assume unlimited free storage. |
| Cloudflare SPA routing | With no top-level `404.html`, Pages documents fallback to the root for unknown non-asset routes. [1](https://developers.cloudflare.com/pages/platform/serving-pages/) | Test direct public run links on the real deployment. |
| Privy | Current pricing page https://www.privy.io/pricing lists Developer free at 0–499 MAU, with 50,000 signatures and $1M transaction volume per month; 500–2,499 MAU Core is listed at $299/month. | Build stays free; cap usage and avoid paid upgrades. Quotas, definitions, eligibility and terms may change. |
| Privy wallets | Documentation says automatic embedded Ethereum wallet creation can be configured `off`. [1](https://docs.privy.io/basics/react/advanced/automatic-wallet-creation) | Offer explicit user choice; validate the actual Google/external/embedded flow. |
| Privy backend auth | Access and identity tokens serve different purposes; verify tokens as documented, and verify linked-account data rather than trusting a client address. [1](https://docs.privy.io/authentication/user-authentication/access-tokens), [2](https://docs.privy.io/user-management/users/identity-tokens) | Add a short-lived one-use wallet-control challenge for protected server resources; spike library compatibility and CPU limits. |
| Groq model access | User reported for each of `openai/gpt-oss-120b` and `openai/gpt-oss-20b`: 30 RPM, 1,000 RPD, 8,000 TPM and 200,000 TPD. Provider says organisation limits must be checked in console: https://console.groq.com/docs/rate-limits. | Treat as account-specific working information, not a permanent public guarantee. App-level caps and 429 handling are still required. |
| Groq structured outputs | https://console.groq.com/docs/structured-outputs documents strict JSON Schema for GPT-OSS 20B/120B; the fetched docs note structured-output limitations including streaming/tool use. | Validate schema and semantics independently. Schema compliance is not security or logical validity. |
| Groq data | https://console.groq.com/docs/your-data describes data handling and exceptions. | Minimise submitted context and disclose provider processing. Do not promise zero retention. |
| GitHub Actions | Standard GitHub-hosted runners in public repositories are documented as free; larger runners and storage may have different charges. [1](https://docs.github.com/en/billing/concepts/product-billing/github-actions) | Use a public repo and standard runners; monitor storage and terms. |

### Budget sensitivity, not a quotation

- A small project can **target** $0 in external services if all free-tier rules, account eligibility and test-token access hold. Personal hardware, connectivity and labour are outside this estimate.
- 100 authenticated users may fit under the listed Privy free MAU band, but signatures, transaction volume, Cloudflare, Groq, rate caps and bursts also matter. It is not an SLA or capacity guarantee.
- 1,000 authenticated monthly users exceed the currently listed Privy free band. Its public site lists the relevant Core tier at $299/month; this is not authorised spending. Restrict signups/usage or revisit the design only with owner approval.
- A hypothetical $79/team/month future offering is merely a pricing test. Four teams would gross $316/month, only $17 above that illustrative Privy fee before any other costs, so the unit economics need real validation.

## 6. Competitive context and honest differentiation

- **Foundry:** open-source Solidity testing, invariant fuzzing and replay; its current docs describe seeded and symbolic/stateful testing [1](https://book.getfoundry.sh/forge/advanced-testing). Vareq should complement it rather than claim these capabilities are unique.
- **Echidna:** property-based smart-contract fuzzer, AGPLv3 [1](https://github.com/crytic/echidna).
- **Medusa:** parallel, coverage-guided Solidity fuzzer, AGPLv3 [1](https://github.com/crytic/medusa).
- **Certora Prover:** formal verification; its current page lists a free Basic tier with up to 2,000 runtime minutes/month [2](https://www.certora.com/prover). Vareq's bounded testing is not equivalent to formal verification.
- **Tenderly:** simulation/debugging/virtual-testnet tooling. Its own 2024 announcement describes the product and a limited-time free trial [1](https://tenderly.co/blog/changelog/tenderly-releases-virtual-testnets/); check current prices and Portaldot support before making a comparison. Do not assert a capability is absent without verifying.
- **PortalLink:** https://github.com/XachP/portallink describes an attested bridge and existing Foundry unit/fuzz/stateful-invariant tests. It is overlapping ecosystem work, not evidence that Vareq's approach is globally novel.
- **DotGas:** https://github.com/itsolaph/dotgas describes a Base-to-Portaldot gas-onboarding bridge and related timing concerns; its repository was shown as archived on 27 Oct 2026. It is adjacent work, not a competitor audit or proof of any vulnerability.

**Hypothesised differentiation:** package adapter-defined bridge actions, bounded message timing, optional AI-generated scenario data and reviewer-readable provenance into one reproducible workflow. This is a testable product hypothesis, not a global uniqueness claim. The event's build listing initially exposes only a subset of submissions, so it cannot establish competition-wide novelty.

## 7. Name and brand checks

- The name **Vareq** was selected by the owner. https://github.com/vareq is already an existing GitHub account; this does not by itself establish a conflicting product or trademark.
- Repository/organisation handle, npm package, domain, trademark, company and other marketplace availability have **not** been cleared. Check independently before public launch or package publication.
- No icon, logo, wordmark artwork or brand symbol is approved. Plain typed `Vareq` is the current UI treatment; ask the owner before creating a brand mark.

## 8. Risk register and decision triggers

| Priority | Risk | Trigger / mitigation |
|---|---|---|
| P0 | Missed check-in may affect eligibility | Contact organisers now; record their response, do not self-declare disqualified or eligible. |
| P0 | Deadline ambiguity | Confirm 03:00 vs 04:00 UTC; work to earlier boundary until confirmed; finish core before conservative last-24-hour window. |
| P0 | V3 funding/deployment/account mapping unknown | Early funded test-only deployment spike and organiser guidance. Local fallback is not event-compliant deployment. |
| P0 | Misleading safety or chain evidence | Strict evidence-mode labelling, actual receipts, same-run correlation, explicit incomplete status and trusted-coordinator disclosure. |
| P0 | AI or public user controls a signer | No arbitrary code, generic relaying or AI signing; separate test-only accounts, manual approval and caps. |
| P1 | Free gateway cannot verify auth within runtime/CPU | Measure early; redesign/disable protected AI, not security or secret handling. Curated offline workflow remains. |
| P1 | Model and local EVM diverge | Parity test supported scenarios; block parity claims and display discrepancy. |
| P1 | Free-tier quotas or wallet funding exhausted | Hard caps and kill switches; preserve public reading and curated local demo; no paid tier without approval. |
| P1 | Private information leaks in public trace or prompts | Minimise inputs, deliberate publication, sanitisation, secret scan, safe rendering and retention limits. |
| P2 | Namespace conflicts | Check handle, package, domain and trademarks before publishing. |
| P2 | Solo timeline is ambitious | Deliver V3 evidence and honest deterministic case first; reduce polish before security or provenance. |

## 9. Outstanding owner/organiser inputs

- Explicit approval or changes to the planning documents before code.
- Organiser response on late eligibility, governing deadline, V3 test funding, account mapping, tooling and receipt verification.
- Owner-controlled public repository handle and final open-source licence after namespace/dependency review.
- Actual free-account provisioning and current quota values; no account credentials need to be shared with the assistant in chat.
- Verified Portaldot chain currency metadata, deployment method, gas/storage costs and actual contract addresses/receipts.
- Evidence of actual user demand and pricing willingness after the event; current commercial statements are hypotheses.
