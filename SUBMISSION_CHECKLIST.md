# Vareq — Hackathon Submission & Evidence Checklist

**Current status (3 Nov 2026):** The public repository, Vercel app, local reference model and pitch deck exist. Production testnet receipt lookup is enabled and the Portaldot V3 RPC/receipt path has passed preflight, but no fixture contract or public transaction receipt has been produced because the deployer has no test gas. The local role-aware fixture now requires separate deployer/user, operator and attester test accounts; the operator also needs gas. Hosted AI remains disabled until Upstash REST credentials are added and the authenticated flow is verified. The final video and event submission remain open. Check a box only after its evidence is actually verified.

## 1. Immediate organiser questions

- [ ] Ask whether the project remains eligible despite missing the **24 Oct, 12:00 UTC / 13:00 WAT** check-in. Do not assume acceptance or disqualification.
- [ ] Confirm the actual final deadline/code freeze. The official detail schedule says **6 Nov, 04:00 UTC / 05:00 WAT**, but the page header says **5 Nov, 23:00 UTC−4 = 6 Nov, 03:00 UTC / 04:00 WAT**. Until confirmed, use the **earlier 03:00 UTC** time.
- [ ] Request the official free V3 test-token route and clarify how a funded native SS58 address beginning `5` relates to or funds the particular EVM wallet used for deployment and interaction.
- [ ] Ask which V3 Solidity/Foundry/EVM or native deployment path is currently supported; how storage deposits, gas units, native/EVM decimals, network metadata and publicly inspectable transaction receipts should be checked.
- [ ] Confirm whether a source-on-Base, destination-on-Portaldot test-only reference bridge is an appropriate Multi-Chain & Cross-Chain Infra demonstration.

Official Discord: https://discord.gg/portaldot. Official event page: https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail. Send only public account addresses and registration information if required—**never a seed phrase or private key**.

### Suggested organiser message

> Hi, I am planning a bridge-testing developer tool for the Multi-Chain & Cross-Chain Infra track. I missed the October 24 check-in; can I still submit or complete a late check-in? The detailed schedule shows November 6 at 04:00 UTC, but the header appears to show 03:00 UTC. Which deadline governs? Also, can you confirm the current V3 contract deployment method, how to fund an EVM test signer from a native SS58 account, and where to verify receipts? I can provide my public native address and registration proof through the official support process.

## 2. Event compliance

- [ ] Obtain explicit owner approval before creating project code.
- [ ] Obtain organiser guidance on late eligibility; record the response without presenting it as a guarantee of winning.
- [ ] Keep the project repository public during the event.
- [ ] Produce at least **three valid, substantive event-period commits** with real sustained development. Do not backdate commits or claim history that does not exist.
- [ ] Ensure core module final versions are not all committed in the last 24 hours before the deadline. Conservative 24-hour window begins **5 Nov, 03:00 UTC / 04:00 WAT**. Target a complete core by **4 Nov, 18:00 UTC / 19:00 WAT**.
- [ ] Use primarily work produced during the event; disclose and respect third-party licences and asset sources.
- [ ] Complete an actual Portaldot V3 testnet deployment and capture verifiable interaction evidence. A local-only fallback is useful but does not meet this event requirement.
- [ ] Freeze substantial functionality at the applicable deadline; report serious required post-freeze changes according to organiser rules.

## 3. Submission materials

| Material | Evidence to prepare | Status |
|---|---|---|
| Project name and track | Vareq; recommended Multi-Chain & Cross-Chain Infra track, subject to organiser confirmation. | [ ] |
| One-sentence overview | `AI-assisted bridge testing that turns bounded timing scenarios into reproducible local traces and separately labelled testnet evidence.` | [ ] |
| Public repository | Real URL, public access, event-period development and at least three valid commits. | [ ] |
| README | Problem, architecture, actual setup, tested commands, adapter, offline/local demo, threat model, limits, licences, configuration and deployment information. | [ ] |
| Runnable demonstration | Public web URL or clear tested local instructions. Published runs readable without login; wallet required for actions. | [ ] |
| Contract and transaction evidence | Actual Portaldot V3 and Base Sepolia chain IDs, deployed addresses, transaction hashes, receipts, signer roles and genuine explorer/console links if supported. | [ ] |
| Demo video | Publicly accessible, **no longer than 3 minutes**, showing a real product and real Portaldot integration. | [ ] |
| Pitch deck | PDF or publicly accessible link; problem, why Portaldot, proof, limits and credible follow-on plan. | [ ] |
| Final submission | Submit through DoraHacks by the confirmed time; internal target **5 Nov, 18:00 UTC / 19:00 WAT**. | [ ] |

## 4. Evidence matrix — record only observed facts

| Claim | Minimum evidence before making it | Important limitation |
|---|---|---|
| Vulnerable race reproduced | A controlled local EVM run with its exact scenario/fixture, source refund + destination fill, failed claim, invariant violation, seed and trace. | Intentionally vulnerable reference fixture, not proof of a production bridge flaw. |
| Patched comparison works | Same attempted scenario and bounds, a real patched run, preserved trace and honest-coordinator assumptions. | Limited counterexample avoided; not an audit or general safety proof. |
| Deterministic replay | Same reconstructed local fixture, scenario, seed and pinned versions reproduced at least twice with matching normalised trace. | Ephemeral snapshot IDs alone are insufficient; public testnets are not deterministic. |
| Browser model aligns | Actual parity tests comparing browser model semantics with local EVM outputs for the supported reference actions. | Browser model is not an EVM. |
| SDK/CI integration works | Real adapter, tested commands, passing offline CI and correct nonzero exit for unexpected violation/infrastructure failure. | Exact commands/package names must not be shown until they exist and are tested. |
| AI contributes | A real Groq proposal, provider/model provenance, successful schema + semantic validation, and a meaningful accepted scenario. | AI is untrusted data; curated fallback must not be labelled AI-generated. |
| Public inspector works | Open a published run in a fresh signed-out browser and inspect a trace; attempt a gated action and verify it requires a connected wallet. | Public reading and authenticated actions are different permissions. |
| Portaldot V3 integration | Actual deployed address, real deployment hash, authorised interaction hash, chain ID and independently checked receipt/console evidence. | Check network/account mapping; an RPC-reported receipt is not cross-chain finality proof. |
| Base Sepolia integration | Actual source contract/action and real hash/receipt on chain ID 84532. | Does not establish a native Portaldot–Base bridge. |
| Live full race completed | Correlated real transactions and observations from the same transfer/run, with signer roles, receipt states and timing. | If any action is missing or reordered, report the actual result as incomplete or different. |

## 5. Judge demo and video runbook — ≤3 minutes

Use actual working product screens and verified links; if a step is unavailable, state that and show the working evidence instead.

| Time | Show | Narration objective |
|---|---|---|
| 0:00–0:20 | Problem and trace context | Explain a delayed destination fill racing a source refund. |
| 0:20–0:50 | Published local EVM trace | Point to the actual vulnerable invariant violation and order; identify it as local controlled evidence. |
| 0:50–1:15 | Patched comparison | Show the same attempted scenario and clearly name the trusted coordinator and its assumptions. |
| 1:15–1:40 | SDK/CI artefact | Show actual working local/CI result and how a bridge developer can adapt the scenario. No invented shell commands. |
| 1:40–2:10 | Real testnet evidence | Open the actual V3 and Base transactions/receipts and identify the user and operator roles. Say if full live race is incomplete. |
| 2:10–2:35 | Bounded AI, if genuinely working | Show a validated proposal, its origin label and what is not allowed; otherwise use the explicitly curated fallback. |
| 2:35–3:00 | Limits and next step | State local vs public-chain replay boundary, no safety proof, open-source contribution and realistic next customer. |

For a live judge demo, preflight wallets, testnet funds, operator availability, network IDs, pinned scenario and receipt links. Keep a prerecorded version and a local/offline trace available. The prerecorded video must itself show real work, not a fabricated substitute.

## 6. Suggested pitch deck structure

1. **Problem:** asynchronous refund/fill race and who bears the loss.
2. **Product:** adapter → scenario → deterministic local schedule → inspectable artefact.
3. **Demonstration:** real vulnerable and patched result with coordinator trust caveat.
4. **Portaldot relevance:** real V3 destination interaction and testnet evidence; no claim of a native production bridge.
5. **Differentiation:** bridge-specific workflow beside Foundry/Echidna/Medusa/formal methods; acknowledge adjacent Hacker House bridge work.
6. **Business and sustainability:** free open-source core; clearly hypothetical hosted collaboration, validation plan and honest costs.
7. **Limits and ask:** bounded tests, trusted coordinator, public-chain uncertainty, next integrations and support sought.

## 7. Final pre-submit checks

- [ ] All public claims match the actual repository, deployed contracts and video.
- [ ] Public trace content is sanitised; no secrets, bearer tokens, private RPC URLs, unreleased customer code or unnecessary personal data.
- [ ] Public links, README instructions, contract addresses, chain IDs, receipts and video permissions independently tested in a signed-out browser.
- [ ] Free quotas are within budget; no automatic paid upgrade or real-fund requirement.
- [ ] No logos/brand symbols added without owner approval; no fake metrics, testimonials or results.
- [ ] The organiser's eligibility and deadline answers are recorded, or uncertainty is clearly disclosed.
- [ ] Save final DoraHacks submission confirmation and timestamp without exposing personal information.
