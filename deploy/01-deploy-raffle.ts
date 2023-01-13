import { HardhatRuntimeEnvironment } from "hardhat/types"
import { ethers, network } from "hardhat"

import { networkConfig, localChains } from "../helper-hardhat.config"
import { VRFCoordinatorV2Mock } from "../typechain-types"

const deploy = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const ticketPrice = networkConfig[network.name].ticketPrice

  let vrfCoordinatorAddress: string
  let subscriptionId
  if (localChains.includes(network.name)) {
    const vrfCoordinator: VRFCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    )
    vrfCoordinatorAddress = vrfCoordinator.address
    const res = await vrfCoordinator.createSubscription()
    const receipt = await res.wait(1)
    subscriptionId = receipt.events?.[0].args?.subId
  } else {
    vrfCoordinatorAddress = networkConfig[network.name]
      .vrfCoordinatorAddress as string
    subscriptionId = networkConfig[network.name].subscriptionId
  }

  const keyHash = networkConfig[network.name].keyHash
  const callbackGasLimit = networkConfig[network.name].callbackGasLimit
  const interval = `${networkConfig[network.name].interval}`

  const raffle = await deploy("Raffle", {
    from: deployer,
    log: true,
    args: [
      ticketPrice,
      vrfCoordinatorAddress,
      subscriptionId,
      keyHash,
      callbackGasLimit,
      interval,
    ],
  })

  if (localChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    )
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
  }
}

deploy.tags = ["raffle", "all"]

export default deploy
