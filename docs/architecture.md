# Vareq architecture and verified status

## Data path

    Curated or explicitly consented Groq scenario
            |
            v
    Strict schema + semantic dependency validation
            |
            v
    Seeded deterministic scheduler
            |
            v
    TypeScript reference model -----> JSON run artefact -----> local CLI / signed-out inspector

    Separate Solidity fixtures -----> Foundry tests
    Hosted AI proposal -----------> Vercel Function -> Privy wallet proof -> Upstash -> Groq
    Receipt lookup ---------------> read-only Vercel Function -> allowlisted RPC -> chain check -> receipt

The browser inspector displays sanitized model artefacts and labels their evidence mode. It does not claim EVM execution or public-chain settlement.

The scheduler ranks ready actions by SHA-256 over a versioned encoding of the seed, scenario ID, and action ID. Dependencies retain their explicit attempted or succeeded meaning. A fixed scenario with fixed inputs yields a stable semantic trace in the reference model.

## Verified on 5 Nov 2026

- GitHub Actions app tests/build and Solidity Foundry tests pass. The native fixture build is being retargeted from ink! 4's unsupported seal2 host call to ink! 3's legacy seal0/seal1 ABI.
- A real Groq response produced a seven-action proposal that passed Vareq's schema and semantic validation. The vulnerable and patched outcomes were then replayed through the local reference model; these are not EVM or testnet results.
- Vercel production has VITE_ENABLE_AI=true and VITE_ENABLE_TESTNET=true, plus the required server-side Groq, Privy, and Upstash variables. The complete Privy-authenticated production proposal flow remains unverified.
- The production native receipt endpoint confirmed a finalized 1 tPOT transfer from the operator SS58 account to the distinct attester. This funded the account; it did not invoke a contract.
- A read-only deployment check rejected the ink! 4.3 artifact with "Can't load the module into wasmi!"; no contract deployment transaction was submitted. The current legacy-ABI build must pass CI and a fresh live dry run before a deployment can be reported.
- Read-only balance checks returned 0 ETH on Base Sepolia (chain ID 84532) and 0 native EVM units on Portaldot V3 (chain ID 420420777) for the shared disposable EVM signer.

## Remaining live gates

1. Produce a native artifact with imports supported by Portaldot V3; verify its exact bundle with a read-only V3 instantiate dry run and sufficient operator balance before deploying.
2. Fund the Base Sepolia EVM signer, deploy the source fixture and obtain a real lock/refund receipt.
3. After the native destination contract is deployed, verify the attester's Base receipt observation and the separate operator fill on Portaldot. Correlate those receipts to one transfer before claiming a live cross-chain race.
4. Complete one authenticated Privy-to-Groq proposal in production and verify quota/challenge behavior without exposing credentials.
5. Finish the short demo video and DoraHacks submission. The late-check-in screenshot indicates submission may remain open but says prize eligibility is unconfirmed; record the organizer's answer rather than assuming eligibility.

## Security and evidence boundaries

- The EVM operator, attester, and deployer can share one disposable test-only key for the valueless teaching fixture. That removes independent EVM role control. Native Polkadot operator and attester accounts remain separate.
- Native and EVM signer keys, encrypted wallet exports, and wallet passwords stay out of the repository and Vercel.
- A native tPOT transfer does not prove that a mapped EVM address is funded.
- The native destination fixture records a trusted off-chain attestation of Base evidence. It does not verify Base consensus on-chain, transfer assets, or provide trustless cross-chain finality.
- The local reference model, local EVM fixtures, and testnet contracts are research/teaching tools, not an audit or proof of safety.
