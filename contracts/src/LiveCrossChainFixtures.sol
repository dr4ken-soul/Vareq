// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Shared personal-sign digests for the valueless two-chain demo.
/// @dev This is an explicit trusted-attester demonstration, not a bridge verifier.
library VareqLiveDigests {
    bytes32 internal constant FILL_PERMIT_TYPEHASH = keccak256(
        "VareqFillPermit(uint256 sourceChainId,uint256 destinationChainId,address sourceFixture,address destinationFixture,bytes32 transferId,address user,address operator,uint256 units)"
    );
    bytes32 internal constant FILL_ATTESTATION_TYPEHASH = keccak256(
        "VareqFillAttestation(uint256 sourceChainId,uint256 destinationChainId,address sourceFixture,address destinationFixture,bytes32 transferId,address user,address operator,uint256 units,bytes32 fillTransactionHash)"
    );
    uint256 private constant SECP256K1_HALF_ORDER =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    function fillPermitHash(
        uint256 sourceChainId,
        uint256 destinationChainId,
        address sourceFixture,
        address destinationFixture,
        bytes32 transferId,
        address user,
        address operator,
        uint256 units
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                FILL_PERMIT_TYPEHASH,
                sourceChainId,
                destinationChainId,
                sourceFixture,
                destinationFixture,
                transferId,
                user,
                operator,
                units
            )
        );
    }

    function fillAttestationHash(
        uint256 sourceChainId,
        uint256 destinationChainId,
        address sourceFixture,
        address destinationFixture,
        bytes32 transferId,
        address user,
        address operator,
        uint256 units,
        bytes32 fillTransactionHash
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                FILL_ATTESTATION_TYPEHASH,
                sourceChainId,
                destinationChainId,
                sourceFixture,
                destinationFixture,
                transferId,
                user,
                operator,
                units,
                fillTransactionHash
            )
        );
    }

    function recoverPersonal(bytes32 messageHash, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > SECP256K1_HALF_ORDER) return address(0);
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address recovered = ecrecover(digest, v, r, s);
        return recovered == address(0) ? address(0) : recovered;
    }
}

/// @notice Base Sepolia source-side fixture for Vareq's live race demonstration.
/// @dev Stores only valueless integer units. The patched mode makes refund and fill
///      authorization mutually exclusive. The vulnerable mode intentionally does not.
contract TestnetSourceFixture {
    uint256 public constant MAX_UNITS = 10;

    address public immutable operator;
    address public immutable attester;
    uint256 public immutable destinationChainId;
    address public immutable destinationFixture;
    bool public immutable patched;

    struct TransferState {
        address user;
        uint256 units;
        bool exists;
        bool fillAuthorized;
        bool refunded;
        bool reimbursed;
    }

    mapping(bytes32 => TransferState) private transfers;

    error Unauthorized();
    error InvalidState();
    error InvalidAttestation();

    event Locked(bytes32 indexed transferId, address indexed user, uint256 units);
    event FillAuthorized(bytes32 indexed transferId, address indexed operator);
    event Refunded(bytes32 indexed transferId, address indexed user, uint256 units);
    event OperatorReimbursed(bytes32 indexed transferId, bytes32 indexed fillTransactionHash);

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    constructor(
        address operator_,
        address attester_,
        uint256 destinationChainId_,
        address destinationFixture_,
        bool patched_
    ) {
        if (
            operator_ == address(0) || attester_ == address(0) || operator_ == attester_ ||
            destinationChainId_ == 0 || destinationFixture_ == address(0)
        ) revert InvalidState();
        operator = operator_;
        attester = attester_;
        destinationChainId = destinationChainId_;
        destinationFixture = destinationFixture_;
        patched = patched_;
    }

    function lock(bytes32 transferId, uint256 units) external {
        if (
            transferId == bytes32(0) || units == 0 || units > MAX_UNITS ||
            transfers[transferId].exists
        ) revert InvalidState();
        transfers[transferId] = TransferState({
            user: msg.sender,
            units: units,
            exists: true,
            fillAuthorized: false,
            refunded: false,
            reimbursed: false
        });
        emit Locked(transferId, msg.sender, units);
    }

    function fillPermitMessageHash(bytes32 transferId) public view returns (bytes32) {
        TransferState storage transfer = transfers[transferId];
        if (!transfer.exists) revert InvalidState();
        return VareqLiveDigests.fillPermitHash(
            block.chainid,
            destinationChainId,
            address(this),
            destinationFixture,
            transferId,
            transfer.user,
            operator,
            transfer.units
        );
    }

    function authorizeFill(bytes32 transferId, bytes calldata signature) external onlyOperator {
        TransferState storage transfer = transfers[transferId];
        if (!transfer.exists || transfer.fillAuthorized || (patched && transfer.refunded)) revert InvalidState();
        if (VareqLiveDigests.recoverPersonal(fillPermitMessageHash(transferId), signature) != attester) {
            revert InvalidAttestation();
        }
        transfer.fillAuthorized = true;
        emit FillAuthorized(transferId, msg.sender);
    }

    function refund(bytes32 transferId) external {
        TransferState storage transfer = transfers[transferId];
        if (!transfer.exists || msg.sender != transfer.user) revert Unauthorized();
        if (transfer.refunded || transfer.reimbursed || (patched && transfer.fillAuthorized)) revert InvalidState();
        transfer.refunded = true;
        emit Refunded(transferId, transfer.user, transfer.units);
    }

    function fillAttestationMessageHash(bytes32 transferId, bytes32 fillTransactionHash)
        public
        view
        returns (bytes32)
    {
        TransferState storage transfer = transfers[transferId];
        if (!transfer.exists || !transfer.fillAuthorized || fillTransactionHash == bytes32(0)) {
            revert InvalidState();
        }
        return VareqLiveDigests.fillAttestationHash(
            block.chainid,
            destinationChainId,
            address(this),
            destinationFixture,
            transferId,
            transfer.user,
            operator,
            transfer.units,
            fillTransactionHash
        );
    }

    function claim(bytes32 transferId, bytes32 fillTransactionHash, bytes calldata signature)
        external
        onlyOperator
    {
        TransferState storage transfer = transfers[transferId];
        if (!transfer.exists || !transfer.fillAuthorized || transfer.refunded || transfer.reimbursed) {
            revert InvalidState();
        }
        if (
            VareqLiveDigests.recoverPersonal(
                fillAttestationMessageHash(transferId, fillTransactionHash),
                signature
            ) != attester
        ) revert InvalidAttestation();
        transfer.reimbursed = true;
        emit OperatorReimbursed(transferId, fillTransactionHash);
    }

    function getTransfer(bytes32 transferId)
        external
        view
        returns (address user, uint256 units, bool exists, bool fillAuthorized, bool refunded, bool reimbursed)
    {
        TransferState storage transfer = transfers[transferId];
        return (
            transfer.user,
            transfer.units,
            transfer.exists,
            transfer.fillAuthorized,
            transfer.refunded,
            transfer.reimbursed
        );
    }
}

/// @notice Portaldot V3 destination-side fixture for Vareq's live race demonstration.
/// @dev A configured trusted attester authorizes the source facts; this is not cross-chain proof.
contract TestnetDestinationFixture {
    uint256 public constant MAX_UNITS = 10;

    address public immutable owner;
    address public immutable operator;
    address public immutable attester;
    uint256 public immutable sourceChainId;
    bool public immutable patched;
    address public sourceFixture;

    struct FillState {
        address user;
        uint256 units;
        bool filled;
    }

    mapping(bytes32 => FillState) private fills;

    error Unauthorized();
    error InvalidState();
    error InvalidAttestation();

    event SourceFixtureConfigured(address indexed sourceFixture);
    event DestinationFilled(bytes32 indexed transferId, address indexed user, address indexed operator, uint256 units);

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    constructor(address operator_, address attester_, uint256 sourceChainId_, bool patched_) {
        if (operator_ == address(0) || attester_ == address(0) || operator_ == attester_ || sourceChainId_ == 0) {
            revert InvalidState();
        }
        owner = msg.sender;
        operator = operator_;
        attester = attester_;
        sourceChainId = sourceChainId_;
        patched = patched_;
    }

    function setSourceFixture(address sourceFixture_) external {
        if (msg.sender != owner) revert Unauthorized();
        if (sourceFixture != address(0) || sourceFixture_ == address(0)) revert InvalidState();
        sourceFixture = sourceFixture_;
        emit SourceFixtureConfigured(sourceFixture_);
    }

    function fillPermitMessageHash(bytes32 transferId, address user, uint256 units)
        public
        view
        returns (bytes32)
    {
        if (sourceFixture == address(0) || transferId == bytes32(0) || user == address(0) || units == 0 || units > MAX_UNITS) {
            revert InvalidState();
        }
        return VareqLiveDigests.fillPermitHash(
            sourceChainId,
            block.chainid,
            sourceFixture,
            address(this),
            transferId,
            user,
            operator,
            units
        );
    }

    function fill(bytes32 transferId, address user, uint256 units, bytes calldata signature) external onlyOperator {
        if (fills[transferId].filled) revert InvalidState();
        if (
            VareqLiveDigests.recoverPersonal(
                fillPermitMessageHash(transferId, user, units),
                signature
            ) != attester
        ) revert InvalidAttestation();
        fills[transferId] = FillState({user: user, units: units, filled: true});
        emit DestinationFilled(transferId, user, msg.sender, units);
    }

    function getFill(bytes32 transferId) external view returns (address user, uint256 units, bool filled) {
        FillState storage fillState = fills[transferId];
        return (fillState.user, fillState.units, fillState.filled);
    }
}
