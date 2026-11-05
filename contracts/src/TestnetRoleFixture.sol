// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Valueless, single-chain testnet fixture for Vareq signer roles.
/// @dev This is not a bridge, holds no assets, and does not verify another chain.
contract TestnetRoleFixture {
    bytes32 private constant FILL_PERMIT_TYPEHASH = keccak256(
        "VareqFillPermit(uint256 chainId,address fixture,bytes32 transferId,address user,address operator,uint256 units)"
    );
    bytes32 private constant FILL_ATTESTATION_TYPEHASH = keccak256(
        "VareqFillAttestation(uint256 chainId,address fixture,bytes32 transferId,address user,address operator,uint256 units,bytes32 fillTransactionHash)"
    );
    uint256 private constant SECP256K1_HALF_ORDER =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    address public immutable owner;
    address public immutable user;
    address public immutable operator;
    address public immutable attester;

    bytes32 public transferId;
    uint256 public referenceUnits;
    bool public locked;
    bool public fillPermit;
    bool public destinationFilled;
    bool public operatorReimbursed;

    error Unauthorized();
    error InvalidState();
    error InvalidAttestation();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyUser() {
        if (msg.sender != user) revert Unauthorized();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert Unauthorized();
        _;
    }

    event Locked(bytes32 indexed transferId, address indexed user, uint256 referenceUnits);
    event FillPermitIssued(bytes32 indexed transferId, address indexed attester);
    event DestinationFilled(bytes32 indexed transferId, address indexed operator);
    event OperatorReimbursed(bytes32 indexed transferId, bytes32 indexed fillTransactionHash);

    constructor(address user_, address operator_, address attester_) {
        // This valueless test fixture permits shared test-only signers. Reusing one
        // address collapses the EVM role separation and is not production evidence.
        if (user_ == address(0) || operator_ == address(0) || attester_ == address(0)) revert InvalidState();
        owner = msg.sender;
        user = user_;
        operator = operator_;
        attester = attester_;
    }

    function lock(bytes32 transferId_, uint256 units_) external onlyUser {
        if (locked || transferId_ == bytes32(0) || units_ == 0) revert InvalidState();
        locked = true;
        transferId = transferId_;
        referenceUnits = units_;
        emit Locked(transferId_, msg.sender, units_);
    }

    function fillPermitMessageHash(bytes32 transferId_) external view returns (bytes32) {
        if (!locked || transferId_ != transferId) revert InvalidState();
        return keccak256(
            abi.encode(FILL_PERMIT_TYPEHASH, block.chainid, address(this), transferId_, user, operator, referenceUnits)
        );
    }

    function issueFillPermit(bytes32 transferId_, bytes calldata signature) external onlyOwner {
        if (!locked || transferId_ != transferId || fillPermit || destinationFilled) revert InvalidState();
        bytes32 messageHash = keccak256(
            abi.encode(FILL_PERMIT_TYPEHASH, block.chainid, address(this), transferId_, user, operator, referenceUnits)
        );
        if (_recoverPersonalSign(messageHash, signature) != attester) revert InvalidAttestation();
        fillPermit = true;
        emit FillPermitIssued(transferId_, attester);
    }

    function deliverFill(bytes32 transferId_) external onlyOperator {
        if (!fillPermit || transferId_ != transferId || destinationFilled) revert InvalidState();
        destinationFilled = true;
        emit DestinationFilled(transferId_, msg.sender);
    }

    function fillAttestationMessageHash(bytes32 transferId_, bytes32 fillTransactionHash)
        external
        view
        returns (bytes32)
    {
        if (!destinationFilled || transferId_ != transferId || fillTransactionHash == bytes32(0)) {
            revert InvalidState();
        }
        return keccak256(
            abi.encode(
                FILL_ATTESTATION_TYPEHASH,
                block.chainid,
                address(this),
                transferId_,
                user,
                operator,
                referenceUnits,
                fillTransactionHash
            )
        );
    }

    function claim(bytes32 transferId_, bytes32 fillTransactionHash, bytes calldata signature)
        external
        onlyOperator
    {
        if (!destinationFilled || transferId_ != transferId || operatorReimbursed) revert InvalidState();
        if (fillTransactionHash == bytes32(0)) revert InvalidState();
        bytes32 messageHash = keccak256(
            abi.encode(
                FILL_ATTESTATION_TYPEHASH,
                block.chainid,
                address(this),
                transferId_,
                user,
                operator,
                referenceUnits,
                fillTransactionHash
            )
        );
        if (_recoverPersonalSign(messageHash, signature) != attester) revert InvalidAttestation();
        operatorReimbursed = true;
        emit OperatorReimbursed(transferId_, fillTransactionHash);
    }

    function _recoverPersonalSign(bytes32 messageHash, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) revert InvalidAttestation();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > SECP256K1_HALF_ORDER) revert InvalidAttestation();
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert InvalidAttestation();
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert InvalidAttestation();
        return recovered;
    }
}

