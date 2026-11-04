#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod vareq_portaldot_native_fixture {
    use ink::storage::Mapping;

    const MAX_UNITS: u128 = 10;
    const BASE_SEPOLIA_CHAIN_ID: u32 = 84_532;

    #[derive(scale::Encode, scale::Decode, Clone, Debug, PartialEq, Eq, scale_info::TypeInfo)]
    #[cfg_attr(feature = "std", derive(ink::storage::traits::StorageLayout))]
    pub struct Transfer {
        pub source_transaction: [u8; 32],
        pub source_block: [u8; 32],
        pub source_fixture: [u8; 20],
        pub user: [u8; 20],
        pub units: u128,
        pub attested: bool,
        pub refunded: bool,
        pub filled: bool,
    }

    #[derive(scale::Encode, scale::Decode, Clone, Debug, PartialEq, Eq, scale_info::TypeInfo)]
    pub enum FixtureError {
        Unauthorized,
        InvalidInput,
        AlreadyExists,
        UnknownTransfer,
        InvalidState,
    }

    #[ink(storage)]
    pub struct VareqPortaldotNativeFixture {
        operator: AccountId,
        attester: AccountId,
        patched: bool,
        transfers: Mapping<[u8; 32], Transfer>,
    }

    #[ink(event)]
    pub struct SourceLockAttested {
        #[ink(topic)]
        transfer_id: [u8; 32],
        source_transaction: [u8; 32],
        source_block: [u8; 32],
        source_fixture: [u8; 20],
        user: [u8; 20],
        units: u128,
        attester: AccountId,
    }

    #[ink(event)]
    pub struct SourceRefundAttested {
        #[ink(topic)]
        transfer_id: [u8; 32],
        refund_transaction: [u8; 32],
        attester: AccountId,
    }

    #[ink(event)]
    pub struct DestinationFilled {
        #[ink(topic)]
        transfer_id: [u8; 32],
        source_transaction: [u8; 32],
        user: [u8; 20],
        operator: AccountId,
        units: u128,
    }

    impl VareqPortaldotNativeFixture {
        /// Deploy a valueless destination fixture. The constructor caller is the deployer;
        /// separate SS58 accounts must be supplied for operator and attester.
        #[ink(constructor)]
        pub fn new(operator: AccountId, attester: AccountId, patched: bool) -> Self {
            assert!(operator != attester, "operator and attester must be different accounts");
            Self {
                operator,
                attester,
                patched,
                transfers: Mapping::default(),
            }
        }

        /// Called only after the off-chain attester verifies a successful Base Sepolia
        /// Locked event and its transaction receipt. This records trusted attestation;
        /// it does not claim to verify Base consensus on-chain.
        #[ink(message)]
        pub fn attest_source_lock(
            &mut self,
            transfer_id: [u8; 32],
            source_transaction: [u8; 32],
            source_block: [u8; 32],
            source_fixture: [u8; 20],
            user: [u8; 20],
            units: u128,
        ) -> Result<(), FixtureError> {
            let caller = self.env().caller();
            if caller != self.attester {
                return Err(FixtureError::Unauthorized);
            }
            if is_zero_32(&transfer_id)
                || is_zero_32(&source_transaction)
                || is_zero_32(&source_block)
                || is_zero_20(&source_fixture)
                || is_zero_20(&user)
                || units == 0
                || units > MAX_UNITS
            {
                return Err(FixtureError::InvalidInput);
            }
            if self.transfers.contains(&transfer_id) {
                return Err(FixtureError::AlreadyExists);
            }

            self.transfers.insert(
                &transfer_id,
                &Transfer {
                    source_transaction,
                    source_block,
                    source_fixture,
                    user,
                    units,
                    attested: true,
                    refunded: false,
                    filled: false,
                },
            );
            self.env().emit_event(SourceLockAttested {
                transfer_id,
                source_transaction,
                source_block,
                source_fixture,
                user,
                units,
                attester: caller,
            });
            Ok(())
        }

        /// Called only after the attester verifies a successful Base Sepolia Refunded
        /// event. Patched mode prohibits a refund after a destination fill.
        #[ink(message)]
        pub fn attest_source_refund(
            &mut self,
            transfer_id: [u8; 32],
            refund_transaction: [u8; 32],
        ) -> Result<(), FixtureError> {
            let caller = self.env().caller();
            if caller != self.attester {
                return Err(FixtureError::Unauthorized);
            }
            if is_zero_32(&refund_transaction) {
                return Err(FixtureError::InvalidInput);
            }
            let mut transfer = self.transfers.get(&transfer_id).ok_or(FixtureError::UnknownTransfer)?;
            if transfer.refunded || (self.patched && transfer.filled) {
                return Err(FixtureError::InvalidState);
            }
            transfer.refunded = true;
            self.transfers.insert(&transfer_id, &transfer);
            self.env().emit_event(SourceRefundAttested {
                transfer_id,
                refund_transaction,
                attester: caller,
            });
            Ok(())
        }

        /// Separate operator action. Records a valueless destination fill and emits
        /// a native contracts-pallet event; it transfers no token or asset.
        #[ink(message)]
        pub fn fill(&mut self, transfer_id: [u8; 32]) -> Result<(), FixtureError> {
            let caller = self.env().caller();
            if caller != self.operator {
                return Err(FixtureError::Unauthorized);
            }
            let mut transfer = self.transfers.get(&transfer_id).ok_or(FixtureError::UnknownTransfer)?;
            if !transfer.attested || transfer.filled || (self.patched && transfer.refunded) {
                return Err(FixtureError::InvalidState);
            }
            transfer.filled = true;
            self.transfers.insert(&transfer_id, &transfer);
            self.env().emit_event(DestinationFilled {
                transfer_id,
                source_transaction: transfer.source_transaction,
                user: transfer.user,
                operator: caller,
                units: transfer.units,
            });
            Ok(())
        }

        #[ink(message)]
        pub fn get_transfer(&self, transfer_id: [u8; 32]) -> Option<Transfer> {
            self.transfers.get(&transfer_id)
        }

        #[ink(message)]
        pub fn operator(&self) -> AccountId {
            self.operator
        }

        #[ink(message)]
        pub fn attester(&self) -> AccountId {
            self.attester
        }

        #[ink(message)]
        pub fn patched(&self) -> bool {
            self.patched
        }

        #[ink(message)]
        pub fn source_chain_id(&self) -> u32 {
            BASE_SEPOLIA_CHAIN_ID
        }
    }

    fn is_zero_32(value: &[u8; 32]) -> bool {
        value.iter().all(|byte| *byte == 0)
    }

    fn is_zero_20(value: &[u8; 20]) -> bool {
        value.iter().all(|byte| *byte == 0)
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        fn accounts() -> (AccountId, AccountId, AccountId) {
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            (accounts.alice, accounts.bob, accounts.charlie)
        }

        #[ink::test]
        fn attester_then_operator_fill_records_native_event_state() {
            let (deployer, operator, attester) = accounts();
            let mut contract = VareqPortaldotNativeFixture::new(operator, attester, true);
            let transfer_id = [1; 32];
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(attester);
            assert_eq!(
                contract.attest_source_lock(transfer_id, [2; 32], [3; 32], [4; 20], [5; 20], 1),
                Ok(())
            );
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(operator);
            assert_eq!(contract.fill(transfer_id), Ok(()));
            let state = contract.get_transfer(transfer_id).unwrap();
            assert!(state.attested && state.filled && !state.refunded);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(deployer);
            assert_eq!(contract.fill(transfer_id), Err(FixtureError::Unauthorized));
        }

        #[ink::test]
        fn patched_rejects_fill_after_attested_refund_but_vulnerable_records_race() {
            let (_, operator, attester) = accounts();
            let mut patched = VareqPortaldotNativeFixture::new(operator, attester, true);
            let mut vulnerable = VareqPortaldotNativeFixture::new(operator, attester, false);
            for contract in [&mut patched, &mut vulnerable] {
                ink::env::test::set_caller::<ink::env::DefaultEnvironment>(attester);
                assert_eq!(
                    contract.attest_source_lock([1; 32], [2; 32], [3; 32], [4; 20], [5; 20], 1),
                    Ok(())
                );
                assert_eq!(contract.attest_source_refund([1; 32], [6; 32]), Ok(()));
            }
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(operator);
            assert_eq!(patched.fill([1; 32]), Err(FixtureError::InvalidState));
            assert_eq!(vulnerable.fill([1; 32]), Ok(()));
        }
    }
}