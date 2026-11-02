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
    Hosted AI gateway and public testnet: not connected in this version

Two reviewed, sanitized `local-reference-model` artefacts are bundled in `src/data/published/`. The inspector labels their evidence mode and does not present them as public-chain receipts.

The scheduler ranks ready actions by SHA-256 over a versioned encoding of the seed, scenario ID, and action ID. Dependencies retain their explicit attempted or succeeded meaning. A fixed scenario with fixed inputs yields a stable semantic trace in the reference model.

The current browser app does not claim model/EVM parity. The Solidity fixture has a separate implementation and must be tested independently. Its single-contract source/destination simplification is intentionally narrow.

## Explicit gaps before a live submission

1. A Bun lockfile is present; a clean-checkout install has not been verified.
2. The Vite production build passes. Vitest could not load its config in the restricted local filesystem; rerun it in CI and complete responsive/accessibility review.
3. Foundry tests are written but have not been run; install Forge and record the exact toolchain version.
4. Complete the event organizer check-in/deadline questions.
5. Confirm Portaldot V3 deployment/funding path; deploy a test-only contract and publish actual receipt evidence.
6. Configure Privy and complete external-wallet and explicit embedded-wallet flows.
7. Implement and review a server-side AI gateway with verified authentication, linked-wallet proof, one-use challenge storage and quota controls before enabling browser AI proposals.
8. The two published examples are local model traces only. Add public-chain traces only after observing and verifying real receipts. The pitch deck is prepared; the required ≤3-minute live-evidence video is not.

The current repo has not passed these gates merely because the steps are documented.
