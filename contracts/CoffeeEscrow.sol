// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CoffeeBatchNFT.sol";
import "./ParticipantRegistry.sol";

/**
 * @title CoffeeEscrow
 * @notice Trustless payment for a coffee batch. A buyer funds a deal against a
 *         specific batch token. On delivery the escrow atomically:
 *           1. moves batch custody (NFT) from seller to buyer, and
 *           2. releases the locked ETH to the seller.
 *         Either party can be protected: buyer confirms receipt to release,
 *         or seller/buyer can cancel before delivery to refund the buyer.
 *
 *         The escrow is an authorized operator on CoffeeBatchNFT, so it can
 *         perform the custody transfer as part of settlement.
 */
contract CoffeeEscrow is ReentrancyGuard {
    CoffeeBatchNFT public immutable batchNFT;
    ParticipantRegistry public immutable registry;

    enum State { None, Funded, Released, Refunded }

    struct Deal {
        uint256 tokenId;
        address seller;   // current batch owner at funding time (exporter)
        address buyer;
        uint256 amount;   // ETH locked
        State   state;
        uint64  fundedAt;
        string  deliveryNote;
    }

    // one active deal per tokenId at a time
    mapping(uint256 => Deal) public deals;

    event DealFunded(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 amount);
    event DealReleased(uint256 indexed tokenId, address indexed seller, uint256 amount);
    event DealRefunded(uint256 indexed tokenId, address indexed buyer, uint256 amount);

    constructor(address batchNFTAddress, address registryAddress) {
        batchNFT = CoffeeBatchNFT(batchNFTAddress);
        registry = ParticipantRegistry(registryAddress);
    }

    /**
     * @notice Buyer locks payment for a batch currently owned by the seller.
     *         The batch must be at the Exported stage (ready for buyer custody).
     */
    function fundDeal(uint256 tokenId) external payable nonReentrant {
        require(msg.value > 0, "No payment");
        require(deals[tokenId].state == State.None, "Deal exists");
        require(
            registry.hasActiveRole(msg.sender, registry.BUYER_ROLE()),
            "Only active buyers"
        );

        address seller = batchNFT.ownerOf(tokenId);
        require(seller != msg.sender, "Buyer owns batch");

        CoffeeBatchNFT.Batch memory b = batchNFT.getBatch(tokenId);
        require(b.stage == CoffeeBatchNFT.Stage.Exported, "Batch not ready for sale");

        deals[tokenId] = Deal({
            tokenId: tokenId,
            seller: seller,
            buyer: msg.sender,
            amount: msg.value,
            state: State.Funded,
            fundedAt: uint64(block.timestamp),
            deliveryNote: ""
        });

        emit DealFunded(tokenId, msg.sender, seller, msg.value);
    }

    /**
     * @notice Buyer confirms delivery. Escrow moves the NFT to the buyer and
     *         pays the seller. This is the happy path settlement.
     */
    function confirmDelivery(uint256 tokenId, string calldata note) external nonReentrant {
        Deal storage d = deals[tokenId];
        require(d.state == State.Funded, "Not funded");
        require(msg.sender == d.buyer, "Only buyer");

        d.state = State.Released;
        d.deliveryNote = note;

        // Escrow is an authorized operator -> moves custody to buyer,
        // advancing stage to Delivered.
        batchNFT.transferCustody(tokenId, d.buyer, note);

        (bool ok, ) = payable(d.seller).call{value: d.amount}("");
        require(ok, "Payout failed");

        emit DealReleased(tokenId, d.seller, d.amount);
    }

    /**
     * @notice Cancel before delivery -> refund buyer. Callable by buyer or seller.
     */
    function cancelDeal(uint256 tokenId) external nonReentrant {
        Deal storage d = deals[tokenId];
        require(d.state == State.Funded, "Not funded");
        require(msg.sender == d.buyer || msg.sender == d.seller, "Not a party");

        d.state = State.Refunded;
        uint256 amount = d.amount;

        (bool ok, ) = payable(d.buyer).call{value: amount}("");
        require(ok, "Refund failed");

        emit DealRefunded(tokenId, d.buyer, amount);
    }

    function getDeal(uint256 tokenId) external view returns (Deal memory) {
        return deals[tokenId];
    }
}
