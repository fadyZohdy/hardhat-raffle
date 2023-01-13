import { HardhatRuntimeEnvironment } from "hardhat/types"
import { network, ethers } from "hardhat"

import { localChains } from "../helper-hardhat.config"

const deployFunc = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const BASE_FEE = ethers.utils.parseEther("0.25")
  const GAS_PRICE_LINK = ethers.utils.parseEther("0.0000000001")

  if (localChains.includes(network.name)) {
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: [BASE_FEE, GAS_PRICE_LINK],
    })
    log("Mocks Deployed")
    log("-----------------------------------------------")
  }
}

export default deployFunc
deployFunc.tags = ["all", "mocks"]
