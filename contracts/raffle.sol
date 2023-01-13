// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";
import "hardhat/console.sol";

error Raffle__InsufficientFunds(uint256 required, uint256 provided);
error Raffle__TransferFailed();
error Raffle__NotOpen();

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    enum State {
        OPEN,
        CALCULATING
    }

    event PlayerEntered(address indexed player);
    event RequestSent(uint256 indexed requestId);
    event WinnerSelected(address indexed player);

    uint256 public immutable i_ticketPrice;
    address payable[] public players;
    address public recentWinner;

    State public state;

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint64 private immutable i_subscriptionId;
    bytes32 private immutable i_keyHash;
    uint32 private constant NUM_WORDS = 1;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;

    uint32 public immutable i_interval;
    uint256 public lastTimeStamp;

    constructor(
        uint256 ticketPrice,
        address vrfCoordinatorAddress,
        uint64 subscriptionId,
        bytes32 keyHash,
        uint32 callbackGasLimit,
        uint32 interval
    ) VRFConsumerBaseV2(vrfCoordinatorAddress) {
        state = State.OPEN;
        i_ticketPrice = ticketPrice;
        i_subscriptionId = subscriptionId;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorAddress);
        i_keyHash = keyHash;
        i_callbackGasLimit = callbackGasLimit;
        i_interval = interval;
        lastTimeStamp = block.timestamp;
    }

    function enterRaffle() public payable {
        if (msg.value < i_ticketPrice) {
            revert Raffle__InsufficientFunds({
                required: i_ticketPrice,
                provided: msg.value
            });
        }

        if (state != State.OPEN) {
            revert Raffle__NotOpen();
        }

        players.push(payable(msg.sender));

        emit PlayerEntered(msg.sender);
    }

    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool interval_passed = (block.timestamp - lastTimeStamp) > i_interval;
        upkeepNeeded =
            interval_passed &&
            state == State.OPEN &&
            players.length > 0 &&
            address(this).balance > 0;
        return (upkeepNeeded, "0x0");
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (upkeepNeeded) {
            state = State.CALCULATING;

            uint256 requestId = i_vrfCoordinator.requestRandomWords(
                i_keyHash,
                i_subscriptionId,
                REQUEST_CONFIRMATIONS,
                i_callbackGasLimit,
                NUM_WORDS
            );

            emit RequestSent(requestId);
        }
    }

    function fulfillRandomWords(
        uint256 /* _requestId */,
        uint256[] memory _randomWords
    ) internal override {
        uint256 index = _randomWords[0] % players.length;
        recentWinner = players[index];
        players = new address payable[](0);

        (bool paid, ) = payable(recentWinner).call{
            value: address(this).balance
        }("");
        if (!paid) {
            revert Raffle__TransferFailed();
        }

        lastTimeStamp = block.timestamp;
        state = State.OPEN;

        emit WinnerSelected(recentWinner);
    }

    function numPlayers() public view returns (uint256) {
        return players.length;
    }
}
