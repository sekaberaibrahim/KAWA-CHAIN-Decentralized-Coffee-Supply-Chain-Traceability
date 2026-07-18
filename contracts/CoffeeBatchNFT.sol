// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./ParticipantRegistry.sol";

/**
 * @title CoffeeBatchNFT
 * @notice Each coffee batch is a single ERC-721 token. The token IS the
 *         certificate of ownership. Custody moves along the chain
 *         Farmer -> Processor -> Exporter -> Buyer via transfers gated by RBAC.
 *         Every stage and shipment update is recorded on-chain and emitted as
 *         an event for the traceability timeline / QR verification.
 */
contract CoffeeBatchNFT is ERC721URIStorage {
    using Strings for uint256;

    ParticipantRegistry public immutable registry;

    enum Stage { Harvested, Processed, Exported, Delivered }

    struct Batch {
        uint256 id;
        address farmer;         // original producer (immutable provenance)
        string  origin;         // farm / washing station + region
        string  variety;        // e.g. "Bourbon", "Arabica SL28"
        uint32  weightKg;       // net weight in kilograms
        uint16  harvestYear;    // e.g. 2026
        uint8   qualityScore;   // cupping score 0-100
        Stage   stage;
        string  docURI;         // IPFS: certs, lab reports, photos (JSON metadata)
        uint64  createdAt;
    }

    // Shipment event appended at each custody handoff.
    struct Shipment {
        address from;
        address to;
        Stage   stageAfter;
        string  note;       // e.g. "Container MSKU1234567, Port of Mombasa"
        uint64  timestamp;
    }

    uint256 private _nextId = 1;
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => Shipment[]) private _shipments;

    // Contracts allowed to move custody on an owner's behalf (e.g. Escrow).
    mapping(address => bool) public authorizedOperators;
    address public admin;

    event BatchRegistered(uint256 indexed tokenId, address indexed farmer, string origin, uint32 weightKg);
    event StageAdvanced(uint256 indexed tokenId, Stage stage, address indexed by);
    event CustodyTransferred(uint256 indexed tokenId, address indexed from, address indexed to, Stage stageAfter);
    event OperatorSet(address indexed operator, bool allowed);

    constructor(address registryAddress, address admin_)
        ERC721("Rwanda Coffee Batch", "RCB")
    {
        registry = ParticipantRegistry(registryAddress);
        admin = admin_;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    function setOperator(address operator, bool allowed) external onlyAdmin {
        authorizedOperators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    // --- Batch creation: farmers only ---

    function registerBatch(
        string calldata origin,
        string calldata variety,
        uint32 weightKg,
        uint16 harvestYear,
        uint8 qualityScore,
        string calldata docURI
    ) external returns (uint256 tokenId) {
        require(
            registry.hasActiveRole(msg.sender, registry.FARMER_ROLE()),
            "Only active farmers"
        );
        require(weightKg > 0, "Weight required");
        require(qualityScore <= 100, "Score 0-100");

        tokenId = _nextId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, docURI);

        batches[tokenId] = Batch({
            id: tokenId,
            farmer: msg.sender,
            origin: origin,
            variety: variety,
            weightKg: weightKg,
            harvestYear: harvestYear,
            qualityScore: qualityScore,
            stage: Stage.Harvested,
            docURI: docURI,
            createdAt: uint64(block.timestamp)
        });

        _shipments[tokenId].push(Shipment({
            from: address(0),
            to: msg.sender,
            stageAfter: Stage.Harvested,
            note: "Batch harvested and registered",
            timestamp: uint64(block.timestamp)
        }));

        emit BatchRegistered(tokenId, msg.sender, origin, weightKg);
    }

    // --- Custody transfer with role enforcement ---
    // Valid custody flow: Farmer->Processor->Exporter->Buyer.
    // The receiver must hold the correct next role, and the batch stage advances.

    function transferCustody(uint256 tokenId, address to, string calldata note) external {
        address owner = ownerOf(tokenId);
        require(
            msg.sender == owner || authorizedOperators[msg.sender],
            "Not owner or operator"
        );
        Stage next = _validateAndNextStage(tokenId, to);

        _transfer(owner, to, tokenId);
        batches[tokenId].stage = next;

        _shipments[tokenId].push(Shipment({
            from: owner,
            to: to,
            stageAfter: next,
            note: note,
            timestamp: uint64(block.timestamp)
        }));

        emit CustodyTransferred(tokenId, owner, to, next);
        emit StageAdvanced(tokenId, next, msg.sender);
    }

    function _validateAndNextStage(uint256 tokenId, address to) internal view returns (Stage) {
        require(registry.isActive(to), "Recipient inactive");
        Stage current = batches[tokenId].stage;

        if (current == Stage.Harvested) {
            require(registry.hasActiveRole(to, registry.PROCESSOR_ROLE()), "Next must be processor");
            return Stage.Processed;
        } else if (current == Stage.Processed) {
            require(registry.hasActiveRole(to, registry.EXPORTER_ROLE()), "Next must be exporter");
            return Stage.Exported;
        } else if (current == Stage.Exported) {
            require(registry.hasActiveRole(to, registry.BUYER_ROLE()), "Next must be buyer");
            return Stage.Delivered;
        }
        revert("Batch already delivered");
    }

    // --- Views for traceability / QR verification ---

    function getBatch(uint256 tokenId) external view returns (Batch memory) {
        require(_ownerExists(tokenId), "No such batch");
        return batches[tokenId];
    }

    function getShipments(uint256 tokenId) external view returns (Shipment[] memory) {
        return _shipments[tokenId];
    }

    function shipmentCount(uint256 tokenId) external view returns (uint256) {
        return _shipments[tokenId].length;
    }

    function totalBatches() external view returns (uint256) {
        return _nextId - 1;
    }

    function _ownerExists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
