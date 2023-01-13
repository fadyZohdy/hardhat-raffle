import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "hardhat-deploy"
import "dotenv/config"

const config: HardhatUserConfig = {
  solidity: "0.8.8",
  networks: {
    goerli: {
      url: process.env.GOERLI_RPC_URL,
      accounts: [process.env.GOERLI_PRIVATE_KEY as string],
      chainId: 5,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      5: 0,
    },
  },
  mocha: {
    timeout: 200000,
  },
}

export default config
