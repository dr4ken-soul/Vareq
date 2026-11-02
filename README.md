# Vareq

Vareq explores bounded bridge timing scenarios and records an inspectable trace. The current application includes a deterministic TypeScript reference model, a browser inspector, a CLI artefact writer, and a paired Solidity teaching fixture.

**This is a test and research project. It is not a bridge, audit, formal proof, or guarantee that a system is safe. Never use the fixtures with real assets.**

## What exists

- packages/core: strict scenario parsing, dependency checks, deterministic scheduler, bounded reference model and versioned artefact.
- packages/cli: runs the same reference model locally and writes JSON artefacts.
- packages/cli/src/groq.ts: optional local Groq scenario proposal that requires explicit consent, strict JSON output, a 15-second timeout and local semantic validation. It writes a proposal; it never runs it.
- contracts: intentionally unsafe and coordinator-mitigated Solidity fixtures for local Foundry tests. Both execute on one local EVM. This does not implement a cross-chain bridge.
- src: public landing page, signed-out inspector for reviewed local-model examples, and a Privy-gated browser reference-model demonstration.
- scenarios/refund-fill-race.json: curated bounded refund/fill timing scenario.
- docs/design/reference-comps: eight editable visual reference compositions used to guide the landing page.

The browser demo is a TypeScript reference model, not EVM execution. Two sanitized local-model traces are included in the public inspector. Local Solidity tests are separate. No Base Sepolia or Portaldot V3 contract is deployed by this repository yet, and no public-testnet receipt is published.

## Requirements

- Node.js 24 LTS (Node.js 22 or newer is specified in package.json).
- Bun 1.4 or npm 11 to install the workspace and its lockfile.
- Foundry to run the Solidity fixture tests.

## Run locally

    bun install --frozen-lockfile
    bun run dev

Open the local address printed by Vite. Public pages are readable without an account. The reference-model button remains disabled until a Privy app ID is configured; browser actions require authentication and a connected wallet.

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

## Environment

Create and edit the real local .env file. It is excluded by .gitignore and must never be committed.

| Variable | Purpose |
|---|---|
| VITE_SITE_URL | Public origin used by the app. |
| VITE_PRIVY_APP_ID | Public Privy app identifier for the login and wallet UI. |
| VITE_ENABLE_AI | AI gateway switch; remains false until a verified server endpoint is deployed. |
| VITE_ENABLE_TESTNET | Live transaction switch; remains false until deployment, signer and receipt paths are verified. |
| PRIVY_APP_ID, PRIVY_APP_SECRET | Server-side Privy credentials. Never expose them with a VITE_ prefix. |
| GROQ_API_KEY | Server-side Groq key. Never expose it with a VITE_ prefix. |

The supplied .env contains local defaults and blank account credentials. Add real credentials only in the local ignored file or the hosting provider's encrypted environment settings. Do not paste secrets into chat or commit them.

## Evidence modes

- **Local reference model:** bounded TypeScript state-machine execution in the browser or CLI.
- **Local EVM:** test-only Solidity fixture execution on a controlled local EVM.
- **Observed testnet transactions:** independently signed and observed public-chain transactions. This mode is not implemented or evidenced yet.

Recorded playback is not a new execution. A hash of an artefact's input only identifies those bytes; it does not prove the result is true.

## Limits and security

- The coordinator mitigation assumes one authority durably records a single decision per transfer and never equivocates. It can censor or stop progress.
- The Solidity fixtures compress the source/destination relationship into one local EVM contract. They do not demonstrate message passing, finality, reorgs, production authorization, or a real bridge.
- Scenario actions are limited to a fixed schema with a maximum of 20 actions. Browser AI suggestions are not connected; the local CLI proposal requires a Groq key and explicit consent.
- The published examples are validated, sanitized `local-reference-model` artefacts. The public-testnet evidence list remains empty until an observed receipt is verified, sanitized and deliberately released.
- No user, operator or attester private key belongs in this repository.

See the product blueprint (APP_BLUEPRINT.md), build sequence (BUILD_GUIDE.md), frontend specification (FRONTEND_SPEC.md), working rules (CLAUDE.md), and submission checklist (SUBMISSION_CHECKLIST.md) for full assumptions and remaining gates.

## Licence

Vareq-authored code is offered under the MIT License in LICENSE. Dependency licences remain governed by their respective projects.

