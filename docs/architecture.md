# Vareq architecture and current state

## Data path

    Curated scenario JSON
            |
            v
    Strict schema + semantic dependency validation
            |
            v
    Seeded deterministic scheduler
            |
            v
    TypeScript reference model -----> JSON run artefact -----> local CLI / signed-out inspector

    Separate local Solidity fixture + Foundry tests

    Local Groq proposal command: optional, explicit consent, validated, never auto-run
    Hosted Groq path: Vercel Functions -> Privy + wallet proof -> Upstash Redis -> Groq
    Testnet receipt path: read-only Vercel Function -> fixed RPC host -> verified chain ID -> receipt

Two reviewed, sanitized `local-reference-model` artefacts are bundled in `src/data/published/`. The inspector labels their evidence mode and does not present them as public-chain receipts.

The scheduler ranks ready actions by SHA-256 over a versioned encoding of the seed, scenario ID, and action ID. Dependencies retain their explicit attempted or succeeded meaning. A fixed scenario with fixed inputs yields a stable semantic trace in the reference model.

The current browser app does not claim model/EVM parity. The Solidity fixture has a separate implementation and must be tested independently. Its single-contract source/destination simplification is intentionally narrow. The Vercel testnet route observes receipts only; it does not submit transactions, operate signers, or attach evidence to a run. A separate local-only script can deploy a valueless, single-chain role fixture: the deployer/user locks one reference unit, an attester signs a permit and observed-fill attestation, and a separately funded operator submits fill and claim transactions. This is testnet integration evidence, not a cross-chain bridge or asset transfer.

## Explicit gaps before a live submission

1. Verify the final Bun lockfile with a clean install and run the updated unit suite.
2. Complete responsive/accessibility review.
3. Foundry tests are written but have not been run; install Forge and record the exact toolchain version.
4. Complete the event organizer check-in/deadline questions.
5. Confirm Portaldot V3 deployment/funding path; independently verify RPC chain IDs; deploy a test-only contract and publish actual receipt evidence.
6. Add valid Privy app credentials to local and Vercel environments, then complete external-wallet and explicit embedded-wallet flows.
7. Add Groq and Upstash Redis credentials/integration to Vercel, then verify the server AI flow and abuse controls before enabling browser AI proposals.
8. The two published examples are local model traces only. Add public-chain traces only after observing and verifying real receipts. The pitch deck must continue to label these examples as local until genuine receipts exist.

The server endpoints are implemented, but their production feature switches remain off while required credentials, shared storage, RPC identity checks and live contract evidence are incomplete.
