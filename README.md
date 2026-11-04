# Vareq

Vareq explores bounded bridge timing scenarios and records an inspectable trace. The current application includes a deterministic TypeScript reference model, a browser inspector, a CLI artefact writer, and a paired Solidity teaching fixture.

**This is a test and research project. It is not a bridge, audit, formal proof, or guarantee that a system is safe. Never use the fixtures with real assets.**

## What exists

- packages/core: strict scenario parsing, dependency checks, deterministic scheduler, bounded reference model and versioned artefact.
- packages/cli: runs the same reference model locally and writes JSON artefacts.
- packages/cli/src/groq.ts: optional local Groq scenario proposal that requires explicit consent, strict JSON output, a 15-second timeout and local semantic validation. It writes a proposal; it never runs it.
- contracts: intentionally unsafe and patched Solidity fixtures for local testing and a separate two-network, valueless testnet demonstration. The testnet fixtures are an operator-assisted experiment with a trusted attester, not a bridge or proof of finality.
- api: Vercel Functions for a Privy-authenticated, wallet-signed, bounded Groq proposal; an atomic one-use challenge and quota store; and read-only allowlisted testnet receipt lookup.
- src: public landing page and run inspector, a Privy-gated reference-model runner, and an operator-assisted live demo at `/app/testnet` for Base Sepolia → Portaldot V3.
- scenarios/refund-fill-race.json: curated bounded refund/fill timing scenario.
- docs/design/reference-comps: eight editable visual reference compositions used to guide the landing page.

The browser demo is a TypeScript reference model, not EVM execution. Two sanitized local-model traces are included in the public inspector. No Base Sepolia or Portaldot V3 live-demo contract is deployed yet, and no public-testnet interaction evidence is published. The cross-chain fixture scripts can deploy separate vulnerable and patched source/destination contracts, then manually coordinate a user-signed source lock, attested operator authorization, destination fill, and source reimbursement. They have not been broadcast because valid, separately controlled test-only EVM signer accounts and test gas are not available. The fixtures move no assets and do not establish bridge security or cross-chain finality.

## Requirements

- Node.js 24 LTS (Node.js 22 or newer is specified in package.json).
- Bun 1.4 or npm 11 to install the workspace and its lockfile.
- Foundry to run the Solidity fixture tests.

## Run locally

    bun install --frozen-lockfile
    bun run dev

Open the local address printed by Vite. Public pages are readable without an account. Browser actions require Privy authentication and a connected wallet. The hosted AI route requires server-side Privy, Groq and Upstash credentials; the Vercel environment is configured to enable it, but the full authenticated production flow still needs an end-to-end check.

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

## Operator-assisted two-network testnet demo

This demo targets Base Sepolia (84532) as source and Portaldot V3 (420420777) as destination. It uses the connected user's wallet for the source lock/refund, a separate operator account for source authorization/destination fill/source claim, and a separate attester account for off-chain permit/receipt signatures. The operator approves each stage manually. No key is stored in Vercel or used by a server endpoint.

Use three distinct, disposable EVM accounts. Set `TESTNET_DEPLOYER_PRIVATE_KEY`, `OPERATOR_PRIVATE_KEY`, and `ATTESTER_PRIVATE_KEY` in the ignored local `.env`; the deployer pays deployment gas on both networks and the operator pays action gas on both. The attester only signs and needs no gas. Each EVM key must be `0x` followed by exactly 64 hexadecimal characters. An encrypted Polkadot.js wallet export or SS58 address is not an EVM private key; do not paste either into these fields. Obtain gas through the event's approved testnet funding process and verify both chain balances before broadcasting.

Compile/deploy and bind the vulnerable and patched fixture pairs:

    bun run testnet:deploy:crosschain

The script verifies both RPC chain IDs, checks signer separation and gas balances, compiles the Solidity fixtures, and writes an ignored local manifest. It broadcasts only after those checks. Copy the two Base source addresses from `work/live-testnet-deployments.json` to `VITE_BASE_SEPOLIA_SOURCE_VULNERABLE_ADDRESS` and `VITE_BASE_SEPOLIA_SOURCE_PATCHED_ADDRESS`, then rebuild/redeploy the web app. A connected user can sign a bounded source lock on `/app/testnet`. The page displays a command for the manually operated authorization stage:

    bun run testnet:operator -- --stage authorize --mode patched --transfer-id 0x... --source-lock 0x... --approve

The user may then request a refund through their connected wallet, and the operator separately approves settlement:

    bun run testnet:operator -- --stage settle --mode patched --transfer-id 0x... --approve

The operator script checks actual Base/Portaldot state, receipts and refund observations before it proceeds, then writes a public-safe evidence JSON under ignored `work/live-testnet-runs/`. Publish evidence only after checking all hashes, receipts, addresses, roles and chain IDs. The vulnerable fixture intentionally permits the refund/fill race; the patched fixture blocks the conflicting sequence. Public-network timing can still change the observed outcome.

### Legacy single-network role fixture

The earlier `testnet:fixture` command remains a single-network teaching fixture. Never add any signer keys to Vercel, the browser, GitHub, or chat.

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
| VITE_ENABLE_AI | Frontend AI switch. Vercel is configured as `true`; verify authenticated production requests before presenting hosted AI as working. |
| VITE_ENABLE_TESTNET | Enables the read-only receipt lookup and gated live-demo controls. Vercel is configured as `true`; controls remain unavailable until fixture addresses are configured. The API receipt route never signs or submits transactions. |
| BASE_SEPOLIA_RPC_URL, PORTALDOT_V3_EVM_RPC_URL | Allowlisted read-only testnet RPCs. Vareq checks the returned chain ID on every receipt lookup. |
| PRIVY_APP_ID, PRIVY_APP_SECRET | Server-side Privy credentials. Never expose them with a VITE_ prefix. |
| GROQ_API_KEY, GROQ_MODEL | Server-side Groq credentials and the approved model selection. Never expose the key with a VITE_ prefix. |
| UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | Server-only shared storage for one-use challenges and atomic proposal quotas. |
| TESTNET_DEPLOYER_PRIVATE_KEY | Local-only disposable testnet account used as fixture deployer and user. Never add it to Vercel or commit its value. |
| OPERATOR_PRIVATE_KEY | Local-only separate test account that authorizes the source fill, submits the destination fill and submits the source claim. It needs gas on both chains. |
| ATTESTER_PRIVATE_KEY | Local-only separate signer that signs the fill permit and observed-fill attestation; it does not need gas for signing. |
| VITE_BASE_SEPOLIA_SOURCE_VULNERABLE_ADDRESS, VITE_BASE_SEPOLIA_SOURCE_PATCHED_ADDRESS | Public Base Sepolia source-fixture addresses after deployment. The page never receives signer keys. |
| VAREQ_ALLOWED_ORIGINS | Optional comma-separated allowlist for additional exact site origins. |

Set the same Privy App ID in VITE_PRIVY_APP_ID and PRIVY_APP_ID. Keep PRIVY_APP_SECRET, GROQ_API_KEY and Upstash credentials server-side in Vercel encrypted environment settings. Vercel currently has the AI and testnet feature switches enabled; production flow verification and live fixture addresses remain separate requirements. Keep all wallet private keys in the ignored local `.env`; never put them in Vercel or the repository.

Do not add a wallet private key to Vercel. The website has no server-side transaction signer. User-facing actions should be confirmed in the connected wallet. The local fixture script loads the three test-only keys from .env and never exposes or commits them.

## Evidence modes

- **Local reference model:** bounded TypeScript state-machine execution in the browser or CLI.
- **Local EVM:** test-only Solidity fixture execution on a controlled local EVM.
- **Observed testnet transactions:** the receipt endpoint can verify a supplied hash against allowlisted Base Sepolia or Portaldot V3 RPCs. The new operator-assisted fixture can record correlated actions on both chains once deployed and run with funded test-only roles. No live transaction evidence is published yet, and neither action proves a cross-chain bridge.

Recorded playback is not a new execution. A hash of an artefact's input only identifies those bytes; it does not prove the result is true.

## Limits and security

- The coordinator mitigation assumes one authority durably records a single decision per transfer and never equivocates. It can censor or stop progress.
- The local fixture and two-network testnet contracts are teaching models. The testnet attester is trusted; it does not provide trustless message passing or finality, and the demonstration does not support real assets.
- Scenario actions are limited to a fixed schema with a maximum of 20 actions. The hosted Groq flow requires explicit consent, a Privy access token, a verified linked-wallet identity, a domain-bound wallet signature, an atomically consumed challenge, and atomic per-wallet/application quotas. Its server implementation is present but disabled until credentials and shared storage are configured.
- The published examples are validated, sanitized `local-reference-model` artefacts. The public-testnet evidence list remains empty until the live fixture is deployed, correlated receipts/state are verified, and the evidence is deliberately released.
- No user, operator, attester, or testnet deploy private key belongs in this repository.

See the product blueprint (APP_BLUEPRINT.md), build sequence (BUILD_GUIDE.md), frontend specification (FRONTEND_SPEC.md), working rules (CLAUDE.md), and submission checklist (SUBMISSION_CHECKLIST.md) for full assumptions and remaining gates.

## Licence

Vareq-authored code is offered under the MIT License in LICENSE. Dependency licences remain governed by their respective projects.
