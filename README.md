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

The browser demo is a TypeScript reference model, not EVM execution. Two sanitized local-model traces are included in the public inspector. The repository includes two live paths: the existing Base Sepolia + Portaldot EVM fixtures, and a native Portaldot contracts-pallet destination that accepts a trusted attestation of a Base Sepolia receipt. Neither path is represented as deployed until its contract address and finalized transactions are recorded. The fixtures move no assets and do not establish bridge security or cross-chain finality.

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
    cargo test --manifest-path contracts/portaldot-native/Cargo.toml
    cargo contract build --release --manifest-path contracts/portaldot-native/Cargo.toml

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

The first command is a read-only preflight: it verifies both RPC chain IDs, checks signer separation and gas balances, and compiles the Solidity fixtures. It sends no transactions. After reviewing the test-only accounts and balances, explicitly broadcast the six deployment/binding transactions:

    bun run testnet:deploy:crosschain --broadcast

The script writes an ignored local manifest. Copy the two Base source addresses from `work/live-testnet-deployments.json` to `VITE_BASE_SEPOLIA_SOURCE_VULNERABLE_ADDRESS` and `VITE_BASE_SEPOLIA_SOURCE_PATCHED_ADDRESS`, then rebuild/redeploy the web app. A connected user can sign a bounded source lock on `/app/testnet`. The page displays a command for the manually operated authorization stage:

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
| BASE_SEPOLIA_RPC_URL, PORTALDOT_V3_EVM_RPC_URL | Allowlisted read-only EVM RPCs. Vareq checks the returned chain ID on every EVM receipt lookup. |
| PORTALDOT_V3_NATIVE_WS_URL | Portaldot V3's native Substrate websocket (`wss://test-node-v3.portaldot.dev`), used to verify native extrinsics and their finalized events. |
| PRIVY_APP_ID, PRIVY_APP_SECRET | Server-side Privy credentials. Never expose them with a VITE_ prefix. |
| GROQ_API_KEY, GROQ_MODEL | Server-side Groq credentials and the approved model selection. Never expose the key with a VITE_ prefix. |
| UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | Server-only shared storage for one-use challenges and atomic proposal quotas. |
| TESTNET_DEPLOYER_PRIVATE_KEY | Local-only disposable testnet account used as fixture deployer and user. Never add it to Vercel or commit its value. |
| OPERATOR_PRIVATE_KEY | Local-only separate test account that authorizes the source fill, submits the destination fill and submits the source claim. It needs gas on both chains. |
| ATTESTER_PRIVATE_KEY | Local-only separate signer that signs the fill permit and observed-fill attestation; it does not need gas for signing. |
| PORTALDOT_NATIVE_OPERATOR_KEYSTORE_PATH, PORTALDOT_NATIVE_OPERATOR_KEYSTORE_PASSWORD | Local-only path and password for an encrypted native Polkadot operator wallet export. The wallet file stays outside the repository; the password is used only by the local command. The operator pays native deployment/fill fees. |
| PORTALDOT_NATIVE_ATTESTER_KEYSTORE_PATH, PORTALDOT_NATIVE_ATTESTER_KEYSTORE_PASSWORD | Local-only path and password for a separate encrypted native Polkadot attester wallet export. It must be a different SS58 account from the operator. The attester pays native attestation fees. |
| PORTALDOT_NATIVE_FIXTURE_PATCHED_ADDRESS, VITE_PORTALDOT_NATIVE_FIXTURE_PATCHED_ADDRESS | Patched native contract address written locally after deployment; the VITE value is public and contains no secret. |
| PORTALDOT_NATIVE_FIXTURE_VULNERABLE_ADDRESS, VITE_PORTALDOT_NATIVE_FIXTURE_VULNERABLE_ADDRESS | Vulnerable native contract address written locally after deployment; keep it distinct from the patched fixture. |
| PORTALDOT_NATIVE_ARTIFACT_PATH | Optional local path to a built `.contract` bundle when the Cargo target directory is outside the repository. |
| VITE_BASE_SEPOLIA_SOURCE_VULNERABLE_ADDRESS, VITE_BASE_SEPOLIA_SOURCE_PATCHED_ADDRESS | Public Base Sepolia source-fixture addresses after deployment. The page never receives signer keys. |
| VAREQ_ALLOWED_ORIGINS | Optional comma-separated allowlist for additional exact site origins. |

Set the same Privy App ID in VITE_PRIVY_APP_ID and PRIVY_APP_ID. Keep PRIVY_APP_SECRET, GROQ_API_KEY and Upstash credentials server-side in Vercel encrypted environment settings. Vercel currently has the AI and testnet feature switches enabled; production flow verification and live fixture addresses remain separate requirements. Keep all wallet private keys in the ignored local `.env`; never put them in Vercel or the repository.

Do not add wallet keys, encrypted wallet files, or wallet passwords to Vercel. The website has no server-side transaction signer. User-facing Base actions are confirmed in the connected EVM wallet. Native Portaldot signing remains a local, manually approved CLI action; it reads encrypted Polkadot wallet exports from paths outside the repository.

### Native Portaldot evidence path

The receipt inspector can verify Base Sepolia EVM receipts, Portaldot V3 EVM receipts, and native Portaldot Substrate extrinsics. Native receipt lookup requires both the extrinsic hash and the containing block hash. It checks the native runtime identity, the extrinsic included in that block, the signer, success/failure events, and finality status.

The `contracts/portaldot-native` ink! fixture is a native contracts-pallet destination. Its attester is a distinct SS58 signer that checks a successful Base Sepolia `Locked` or `Refunded` event off-chain, then records the source evidence in the contract. A separate operator SS58 account submits the native fill. Patched mode rejects a fill after an attested refund; vulnerable mode can record the race. The contract stores no assets. This is a trusted-attester experiment, not an on-chain Base proof or trustless bridge. The older `testnet:portaldot-native` remark command remains a marker-only receipt utility and is not the contract demo.

Keep both encrypted Polkadot wallet JSON exports and their passwords outside the repository. Set their file paths and passwords in the ignored `.env`; the CLI decrypts locally and never prints private key material. The two SS58 accounts must differ and both need tPOT for their respective fees. Install the pinned native compiler/toolchain, then build the two-mode contracts:

    cargo contract build --release --manifest-path contracts/portaldot-native/Cargo.toml

Deploy the selected mode from the repository root. Review the SS58 operator, attester and estimated fee before running; `--approve --broadcast` is required:

    bun run testnet:portaldot-contract -- --stage deploy --mode patched --approve --broadcast
    bun run testnet:portaldot-contract -- --stage deploy --mode vulnerable --approve --broadcast

After the configured Base Sepolia source fixture is deployed, the connected user submits a lock from `/app/testnet`. The native attester then verifies the source transaction receipt and event before submitting its native contract call; the operator submits the fill separately:

    bun run testnet:portaldot-contract -- --stage attest --mode patched --transfer-id 0x... --source-transaction 0x... --approve --broadcast
    bun run testnet:portaldot-contract -- --stage fill --mode patched --transfer-id 0x... --approve --broadcast

If the Base source refund succeeds, attest that exact refund before filling in vulnerable mode, or observe the patched contract reject the fill:

    bun run testnet:portaldot-contract -- --stage refund --mode vulnerable --transfer-id 0x... --refund-transaction 0x... --approve --broadcast
    bun run testnet:portaldot-contract -- --stage fill --mode vulnerable --transfer-id 0x... --approve --broadcast

The CLI writes sanitized deployment and run evidence under ignored `work/portaldot-native-contract-runs/`, including the native contract address, extrinsic hash, finalized block hash/number, signer and event. Check these values against the independent chain receipt lookup before publishing them. The EVM destination path remains available separately through `testnet:deploy:crosschain` and `testnet:operator`; it is not the native Substrate contracts-pallet route.

The marker-only command remains available for RPC and native extrinsic diagnostics. Do not present its remarks as destination contract actions or fills.

## Evidence modes

- **Local reference model:** bounded TypeScript state-machine execution in the browser or CLI.
- **Local EVM:** test-only Solidity fixture execution on a controlled local EVM.
- **Observed testnet transactions:** the receipt inspector supports Base Sepolia EVM, Portaldot V3 EVM, and native Portaldot Substrate receipts. The native contracts-pallet path can correlate a verified Base `Locked` receipt with an attester transaction and a separate operator fill. These receipts do not prove trustless cross-chain finality.

Recorded playback is not a new execution. A hash of an artefact's input only identifies those bytes; it does not prove the result is true.

## Limits and security

- The coordinator mitigation assumes one authority durably records a single decision per transfer and never equivocates. It can censor or stop progress.
- The local fixture and two-network testnet contracts are teaching models. The testnet attester is trusted; it does not provide trustless message passing or finality, and the demonstration does not support real assets.
- Scenario actions are limited to a fixed schema with a maximum of 20 actions. The hosted Groq flow requires explicit consent, a Privy access token, a verified linked-wallet identity, a domain-bound wallet signature, an atomically consumed challenge, and atomic per-wallet/application quotas. Vercel has the AI switch and required server credentials configured; the authenticated production flow still needs end-to-end verification.
- The published examples are validated, sanitized `local-reference-model` artefacts. The public-testnet evidence list remains empty until the live fixture is deployed, correlated receipts/state are verified, and the evidence is deliberately released.
- No user, operator, attester, or testnet deploy private key belongs in this repository.

See the product blueprint (APP_BLUEPRINT.md), build sequence (BUILD_GUIDE.md), frontend specification (FRONTEND_SPEC.md), working rules (CLAUDE.md), and submission checklist (SUBMISSION_CHECKLIST.md) for full assumptions and remaining gates.

## Licence

Vareq-authored code is offered under the MIT License in LICENSE. Dependency licences remain governed by their respective projects.
