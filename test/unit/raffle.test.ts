import { getNamedAccounts, deployments, ethers, network } from "hardhat"
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types"

import { networkConfig, localChains } from "../../helper-hardhat.config"
import { assert, expect } from "chai"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

!localChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", () => {
      let deployer: string
      let raffle: Raffle
      const ticketPrice = networkConfig[network.name].ticketPrice
      const interval = networkConfig[network.name].interval
      let accounts: SignerWithAddress[]
      let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock
      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        raffle = await ethers.getContract("Raffle")
        accounts = await ethers.getSigners()
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
      })

      describe("constructor", () => {
        it("should initialize state to correct values", async () => {
          const ticketPrice = networkConfig[network.name].ticketPrice
          assert.equal(
            (await raffle.i_ticketPrice()).toString(),
            ticketPrice.toString()
          )

          assert.equal(
            (await raffle.i_interval()).toString(),
            interval.toString()
          )

          assert.equal((await raffle.state()).toString(), "0")
        })
      })

      describe("enterRaffle", () => {
        it("should allow a user to enter raffle and set state correctly", async () => {
          const ticketPrice = networkConfig[network.name].ticketPrice
          const tx = await raffle.enterRaffle({ value: ticketPrice })
          const receipt = await tx.wait(1)
          assert.equal((await raffle.numPlayers()).toString(), "1")
          assert.equal((await raffle.players(0)).toString(), deployer)

          assert.equal(receipt.events?.length, 1)
          expect(receipt.events?.[0].event).to.equal("PlayerEntered")
        })

        it("should NOT allow a player to enter with insufficient funds", async () => {
          const ticketPrice = networkConfig[network.name].ticketPrice
          await expect(
            raffle.enterRaffle({ value: ticketPrice.sub(1) })
          ).to.be.revertedWithCustomError(raffle, "Raffle__InsufficientFunds")
        })

        it("should NOT allow a player to enter when state is not open", async () => {
          const ticketPrice = networkConfig[network.name].ticketPrice
          await raffle.enterRaffle({ value: ticketPrice })

          await network.provider.send("evm_increaseTime", [interval + 1])
          await network.provider.send("evm_mine")

          await raffle.performUpkeep([])

          await expect(
            raffle.enterRaffle({ value: ticketPrice })
          ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen")
        })
      })

      describe("checkUpkeep", () => {
        it("should return false if no players entered", async () => {
          await network.provider.send("evm_increaseTime", [interval + 1])
          await network.provider.send("evm_mine")

          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
          assert(!upkeepNeeded)
        })

        it("should return false if interval not passed", async () => {
          const ticketPrice = networkConfig[network.name].ticketPrice
          await raffle.enterRaffle({ value: ticketPrice })

          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
          assert(!upkeepNeeded)
        })

        it("should return true if all criteria is correct", async () => {
          const ticketPrice = networkConfig[network.name].ticketPrice
          await raffle.enterRaffle({ value: ticketPrice })

          await network.provider.send("evm_increaseTime", [interval + 1])
          await network.provider.send("evm_mine")

          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
          assert(upkeepNeeded)
        })
      })

      describe("performUpkeep", () => {
        it("should NOT request random words when upkeep is NOT needed", async () => {
          await raffle.enterRaffle({ value: ticketPrice })

          const tx = await raffle.performUpkeep("0x")
          const receipt = await tx.wait(1)

          assert.equal(receipt.events?.length, 0)
          assert.equal((await raffle.state()).toString(), "0")
        })

        it("should request random words when upkeep is needed", async () => {
          const ticketPrice = networkConfig[network.name].ticketPrice
          await raffle.enterRaffle({ value: ticketPrice })

          await network.provider.send("evm_increaseTime", [interval + 1])
          await network.provider.send("evm_mine")

          const tx = await raffle.performUpkeep("0x")
          const receipt = await tx.wait(1)

          assert.equal((await raffle.state()).toString(), "1")
          assert.equal(receipt.events?.length, 2)
          assert(receipt.events?.[1].args?.requestId > 0)
        })
      })

      // TODO: listener for WinnerSelected event not working ?!!!!!!!!!!
      describe.skip("fulfillRandomWords", () => {
        it("picks a winner, resets, and sends money", async () => {
          const additionalEntrances = 3 // to test
          const startingIndex = 1
          for (
            let i = startingIndex;
            i < startingIndex + additionalEntrances;
            i++
          ) {
            raffle = raffle.connect(accounts[i])
            await raffle.enterRaffle({ value: ticketPrice })
          }
          const startingTimeStamp = await raffle.lastTimeStamp()

          await new Promise<void>(async (resolve, reject) => {
            raffle.once("WinnerSelected", async () => {
              console.log("WinnerSelected event fired!")
              try {
                const recentWinner = await raffle.recentWinner()
                const raffleState = await raffle.state()
                const winnerBalance = await accounts[2].getBalance()
                const endingTimeStamp = await raffle.lastTimeStamp()
                await expect(raffle.players(0)).to.be.reverted
                // Comparisons to check if our ending values are correct:
                assert.equal(recentWinner.toString(), accounts[2].address)
                assert.equal(raffleState, 0)
                assert.equal(
                  winnerBalance.toString(),
                  startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                    .add(ticketPrice.mul(additionalEntrances).add(ticketPrice))
                    .toString()
                )
                assert(endingTimeStamp > startingTimeStamp)
                resolve() // if try passes, resolves the promise
              } catch (e) {
                reject(e) // if try fails, rejects the promise
              }
            })

            await network.provider.send("evm_increaseTime", [interval + 1])
            await network.provider.send("evm_mine")

            // kicking off the event by mocking the chainlink keepers and vrf coordinator
            const tx = await raffle.performUpkeep("0x")
            const txReceipt = await tx.wait(1)
            const requestId = txReceipt.events?.[1].args?.requestId
            const startingBalance = await accounts[2].getBalance()
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              requestId,
              raffle.address
            )
          })
        })
      })
    })
