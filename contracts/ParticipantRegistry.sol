// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ParticipantRegistry
 * @notice Enterprise RBAC + on-chain identity for every supply-chain actor.
 *         Roles gate who may mint batches, take custody, and release escrow.
 *         Built on OpenZeppelin AccessControl so role admin/grant/revoke are
 *         standard, auditable, and event-logged.
 */
contract ParticipantRegistry is AccessControl {
    // --- Roles ---
    bytes32 public constant ADMIN_ROLE     = keccak256("ADMIN_ROLE");
    bytes32 public constant FARMER_ROLE    = keccak256("FARMER_ROLE");
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant EXPORTER_ROLE  = keccak256("EXPORTER_ROLE");
    bytes32 public constant BUYER_ROLE     = keccak256("BUYER_ROLE");

    enum Role { None, Farmer, Processor, Exporter, Buyer }

    struct Participant {
        string  name;        // display name / cooperative name
        string  location;    // e.g. "Nyamasheke, Western Province"
        string  metadataURI; // IPFS URI to KYC / cert docs
        Role    role;
        bool    active;
        uint64  registeredAt;
    }

    mapping(address => Participant) public participants;
    address[] private _participantList;

    event ParticipantRegistered(address indexed account, Role role, string name);
    event ParticipantDeactivated(address indexed account);
    event ParticipantReactivated(address indexed account);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);

        // Make ADMIN_ROLE the administrator of every operational role,
        // so an admin can grant/revoke participant roles.
        _setRoleAdmin(FARMER_ROLE,    ADMIN_ROLE);
        _setRoleAdmin(PROCESSOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(EXPORTER_ROLE,  ADMIN_ROLE);
        _setRoleAdmin(BUYER_ROLE,     ADMIN_ROLE);
    }

    // --- Registration (self-service onboarding, one role per address) ---

    function registerFarmer(string calldata name, string calldata location, string calldata uri) external {
        _register(msg.sender, Role.Farmer, FARMER_ROLE, name, location, uri);
    }

    function registerProcessor(string calldata name, string calldata location, string calldata uri) external {
        _register(msg.sender, Role.Processor, PROCESSOR_ROLE, name, location, uri);
    }

    function registerExporter(string calldata name, string calldata location, string calldata uri) external {
        _register(msg.sender, Role.Exporter, EXPORTER_ROLE, name, location, uri);
    }

    function registerBuyer(string calldata name, string calldata location, string calldata uri) external {
        _register(msg.sender, Role.Buyer, BUYER_ROLE, name, location, uri);
    }

    function _register(
        address account,
        Role role,
        bytes32 roleId,
        string calldata name,
        string calldata location,
        string calldata uri
    ) internal {
        require(participants[account].role == Role.None, "Already registered");
        require(bytes(name).length > 0, "Name required");

        participants[account] = Participant({
            name: name,
            location: location,
            metadataURI: uri,
            role: role,
            active: true,
            registeredAt: uint64(block.timestamp)
        });
        _participantList.push(account);
        _grantRole(roleId, account);

        emit ParticipantRegistered(account, role, name);
    }

    // --- Admin controls ---

    function deactivate(address account) external onlyRole(ADMIN_ROLE) {
        require(participants[account].active, "Not active");
        participants[account].active = false;
        emit ParticipantDeactivated(account);
    }

    function reactivate(address account) external onlyRole(ADMIN_ROLE) {
        require(!participants[account].active, "Already active");
        require(participants[account].role != Role.None, "Unknown participant");
        participants[account].active = true;
        emit ParticipantReactivated(account);
    }

    // --- Views ---

    function isActive(address account) public view returns (bool) {
        return participants[account].active;
    }

    function roleOf(address account) external view returns (Role) {
        return participants[account].role;
    }

    function getParticipant(address account) external view returns (Participant memory) {
        return participants[account];
    }

    function totalParticipants() external view returns (uint256) {
        return _participantList.length;
    }

    function participantAt(uint256 index) external view returns (address) {
        return _participantList[index];
    }

    /// @notice True only if account holds `role` AND is active. Used by other contracts.
    function hasActiveRole(address account, bytes32 role) external view returns (bool) {
        return hasRole(role, account) && participants[account].active;
    }
}
