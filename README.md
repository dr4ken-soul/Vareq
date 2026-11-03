# Vareq

Vareq explores bounded bridge timing scenarios and records an inspectable trace. The current application includes a deterministic TypeScript reference model, a browser inspector, a CLI artefact writer, and a paired Solidity teaching fixture.

**This is a test and research project. It is not a bridge, audit, formal proof, or guarantee that a system is safe. Never use the fixtures with real assets.**

## What exists

- packages/core: strict scenario parsing, dependency checks, deterministic scheduler, bounded reference model and versioned artefact.
- packages/cli: runs the same reference model locally and writes JSON artefacts.
- packages/cli/src/groq.ts: optional local Groq scenario proposal that requires explicit consent, strict JSON output, a 15-second timeout and local semantic validation. It writes a proposal; it never runs it.
- contracts: intentionally unsafe and coordinator-mitigated Solidity fixtures for local Foundry tests. Both execute on one local EVM. This does not implement a cross-chain bridge.
- api: Vercel Functions for a Privy-authenticated, wallet-signed, bounded Groq proposal; an atomic one-use challenge and quota store; and read-only allowlisted testnet receipt lookup.
- src: public landing page, signed-out inspector for reviewed local-model examples, and a Privy-gated browser reference-model demonstration with an optional AI proposal flow.
- scenarios/refund-fill-race.json: curated bounded refund/fill timing scenario.
- docs/design/reference-comps: eight editable visual reference compositions used to guide the landing page.

The browser demo is a TypeScript reference model, not EVM execution. Two sanitized local-model traces are included in the public inspector. Local Solidity tests are separate. No Base Sepolia or Portaldot V3 contract is deployed yet, and no public-testnet receipt is published. A separate, local-only command can deploy the valueless reference fixture and lock one reference unit on an allowlisted testnet; it does not create or prove a cross-chain bridge flow. The Vercel receipt endpoint only reads a supplied transaction hash.

## Requirements

- Node.js 24 LTS (Node.js 22 or newer is specified in package.json).
- Bun 1.4 or npm 11 to install the workspace and its lockfile.
- Foundry to run the Solidity fixture tests.

## Run locally

    bun install --frozen-lockfile
    bun run dev

Open the local address printed by Vite. Public pages are readable without an account. Browser actions require Privy authentication and a connected wallet. AI proposals also require server credentials and Upstash Redis; they remain disabled by default.

## Verify

    bun run test
    bun run build
    forge test --root contracts

The curated local CLI run writes generated traces under the ignored work/ directory:

    bun run vareq -- run --scenario scenarios/refund-fill-race.json --fixture vulnerable --out work/vulnerable-run.json
    bun run vareq -- run --scenario scenarios/refund-fill-race.json --fixture patched --out work/patched-run.json

The vulnerable scenario is expected to return a nonzero status because its invariant is violated. The patched scenario passes this bounded case only under the stated honest-coordinator assumption. Both outputs are model artefacts, not chain evidence.

For an optional local proposal, add a Groq key to the ignored .env, review the selected input file, and explicitly consent to sending that scenario to Groq:

    bun run vareq -- propose --consent groq --scenario scenarios/refund-fill-race.json --out work/ai-proposal.json

The proposal is labelled AI suggested after local validation. It remains unexecuted until a developer explicitly runs it.

## Optional testnet fixture deployment

This command is a local-only, valueless signer-role demonstration. Add three separate disposable test-only keys to the ignored local .env as TESTNET_DEPLOYER_PRIVATE_KEY, OPERATOR_PRIVATE_KEY, and ATTESTER_PRIVATE_KEY. The deployer also acts as the user; the operator submits the fill and claim transactions; the attester signs the permit and observed-fill message. The deployer/user and operator need test gas. Never add any of these keys to Vercel, the browser, GitHub, or chat.

First run a read-only RPC and Solidity-compilation preflight:

    bun run testnet:fixture --network portaldot-v3

After confirming that the three keys are distinct and funding the deployer/user and operator with test gas, explicitly broadcast the five transactions:

    bun run testnet:fixture --network portaldot-v3 --broadcast

The script checks the RPC chain ID, deploys TestnetRoleFixture, records the user lock, attested permit, operator fill, and attested claim, confirms final state, and writes a secret-free evidence record under evidence/testnet/. Use base-sepolia in place of portaldot-v3 to target Base Sepolia. These are real single-chain transactions against a valueless fixture, not a bridge, cross-chain verification, or asset transfer. The website remains read-only.

## Environment

Create and edit the real local .env file (or copy .env.example). The .env is excluded by .gitignore and must never be committed.

| Variable | Purpose |
|---|---|
| VITE_SITE_URL | Public origin used by the app. |
| VITE_PRIVY_APP_ID | Public Privy app identifier for the login and wallet UI. |
| VITE_ENABLE_AI | AI gateway switch; keep false until Vercel has Privy, Groq and Upstash settings and the full flow is verified. |
| VITE_ENABLE_TESTNET | Read-only receipt lookup switch. Production is enabled after Portaldot V3 RPC identity and receipt lookup preflight; unknown hashes return no receipt. The route never signs or submits transactions. |
| BASE_SEPOLIA_RPC_URL, PORTALDOT_V3_EVM_RPC_URL | Allowlisted read-only testnet RPCs. Vareq checks the returned chain ID on every receipt lookup. |
| PRIVY_APP_ID, PRIVY_APP_SECRET | Server-side Privy credentials. Never expose them with a VITE_ prefix. |
| GROQ_API_KEY, GROQ_MODEL | Server-side Groq credentials and the approved model selection. Never expose the key with a VITE_ prefix. |
| UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | Server-only shared storage for one-use challenges and atomic proposal quotas. |
| TESTNET_DEPLOYER_PRIVATE_KEY | Local-only disposable testnet account used as fixture deployer and user. Never add it to Vercel or commit its value. |
| OPERATOR_PRIVATE_KEY | Local-only separate test account that submits the fixture fill and claim. It needs testnet gas. |
| ATTESTER_PRIVATE_KEY | Local-only separate signer that signs the fill permit and observed-fill attestation; it does not need gas for signing. |
| VAREQ_ALLOWED_ORIGINS | Optional comma-separated allowlist for additional exact site origins. |

Set the same Privy App ID in VITE_PRIVY_APP_ID and PRIVY_APP_ID. Keep PRIVY_APP_SECRET, GROQ_API_KEY and Upstash credentials server-side in Vercel encrypted environment settings. The hosted AI endpoints stay disabled until both Upstash REST values are configured and the authenticated flow is verified. Keep all wallet private keys in the ignored local .env; never put them in Vercel or the repository.

Do not add a wallet private key to Vercel. The website has no server-side transaction signer. User-facing actions should be confirmed in the connected wallet. The local fixture script loads the three test-only keys from .env and never exposes or commits them.

## Evidence modes

- **Local reference model:** bounded TypeScript state-machine execution in the browser or CLI.
- **Local EVM:** test-only Solidity fixture execution on a controlled local EVM.
- **Observed testnet transactions:** the receipt endpoint can verify a submitted hash against a fixed Base Sepolia or Portaldot V3 RPC after the feature switch is enabled. The optional local script can deploy and lock the teaching fixture when explicitly run with `--broadcast`. No live transaction evidence is published yet, and neither action proves a cross-chain bridge.

Recorded playback is not a new execution. A hash of an artefact's input only identifies those bytes; it does not prove the result is true.

## Limits and security

- The coordinator mitigation assumes one authority durably records a single decision per transfer and never equivocates. It can censor or stop progress.
- The Solidity fixtures compress the source/destination relationship into one local EVM contract. They do not demonstrate message passing, finality, reorgs, production authorization, or a real bridge.
- Scenario actions are limited to a fixed schema with a maximum of 20 actions. The hosted Groq flow requires explicit consent, a Privy access token, a verified linked-wallet identity, a domain-bound wallet signature, an atomically consumed challenge, and atomic per-wallet/application quotas. Its server implementation is present but disabled until credentials and shared storage are configured.
- The published examples are validated, sanitized `local-reference-model` artefacts. The public-testnet evidence list remains empty until a real fixture deployment is broadcast, its receipts and state are verified, and the resulting evidence is deliberately released.
- No user, operator, attester, or testnet deploy private key belongs in this repository.

See the product blueprint (APP_BLUEPRINT.md), build sequence (BUILD_GUIDE.md), frontend specification (FRONTEND_SPEC.md), working rules (CLAUDE.md), and submission checklist (SUBMISSION_CHECKLIST.md) for full assumptions and remaining gates.

## Licence

Vareq-authored code is offered under the MIT License in LICENSE. Dependency licences remain governed by their respective projects.
