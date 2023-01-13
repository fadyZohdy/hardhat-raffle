import { BigNumber } from "ethers"
import { ethers } from "hardhat"

export interface NetworkConfigItem {
  vrfCoordinatorAddress?: string
  ticketPrice: BigNumber
  subscriptionId?: string
  keyHash: string
  callbackGasLimit: string
  interval: number
}

export interface NetworkConfig {
  [key: string]: NetworkConfigItem
}

export const networkConfig: NetworkConfig = {
  goerli: {
    vrfCoordinatorAddress: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
    ticketPrice: ethers.utils.parseEther("0.1"),
    subscriptionId: "7917",
    keyHash:
      "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
    callbackGasLimit: "500000",
    interval: 1 * 60 * 60, //seconds
  },
  hardhat: {
    ticketPrice: ethers.utils.parseEther("0.1"),
    keyHash:
      "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
    callbackGasLimit: "500000",
    interval: 1 * 60 * 60, //seconds
  },
}

export const localChains = ["localhost", "hardhat"]
