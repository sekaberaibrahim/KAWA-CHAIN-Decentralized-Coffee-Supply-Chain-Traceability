// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockPriceOracle
 * @notice Simulates a Chainlink-style price feed for green coffee (USD/kg).
 *         Interface mirrors AggregatorV3Interface so it is drop-in swappable
 *         for a real feed in production. Price is 8-decimal fixed point,
 *         matching Chainlink USD feeds.
 */
contract MockPriceOracle is Ownable {
    uint8 public constant decimals = 8;
    string public description = "COFFEE / USD (per kg)";

    int256 private _price;      // 8-decimal, e.g. 4.85 USD => 485000000
    uint256 private _updatedAt;
    uint80  private _roundId;

    event PriceUpdated(int256 price, uint80 roundId, uint256 updatedAt);

    constructor(int256 initialPrice) Ownable(msg.sender) {
        _set(initialPrice);
    }

    /// @notice Push a new price (in real life, an off-chain node calls this).
    function setPrice(int256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be > 0");
        _set(newPrice);
    }

    function _set(int256 p) internal {
        _price = p;
        _updatedAt = block.timestamp;
        _roundId += 1;
        emit PriceUpdated(p, _roundId, block.timestamp);
    }

    /// @notice Chainlink-compatible read.
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (_roundId, _price, _updatedAt, _updatedAt, _roundId);
    }

    function latestPrice() external view returns (int256) {
        return _price;
    }

    /// @notice Convenience: value in USD (8-decimals) of a given kg amount.
    function quote(uint32 weightKg) external view returns (int256) {
        return _price * int256(uint256(weightKg));
    }
}
