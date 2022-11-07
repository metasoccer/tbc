const TokenContract = require("../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const { ethers, network } = require("hardhat");
const {
  daiAddress,
  tokenAddress,
  bancorAddress,
  curveAddress,
} = require("./helpers/addresses");
const fs = require("fs");
const path = require("path");

const blocksPerBatch = 20; //20 //5?? //15 =  300seconds

const openAndClaimBuyOrder =
  require("../../test/helpers/utils").openAndClaimBuyOrder(
    this,
    blocksPerBatch
  );
const openAndClaimSellOrder =
  require("../../test/helpers/utils").openAndClaimSellOrder(blocksPerBatch);
const progressToNextBatch =
  require("../../test/helpers/utils").progressToNextBatch(blocksPerBatch);

async function main() {
  //wallets
  const wallets = await ethers.getSigners();
  this.deployer = wallets[0];
  this.buyer = wallets[1];

  //contracts
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);

  console.log("Connecting to buyer and approving the DAI to the curve");
  const buyOrder = ethers.utils.parseEther("100");
  //const buyOrder = "1000";
  await dai.connect(this.buyer).approve(this.buyer.address, buyOrder);
  await openAndClaimBuyOrder(this.buyer.address, daiAddress, buyOrder);

  //const approval = await dai.connect(buyer).approve(curve.address, buyOrder);
  //approval.wait();

  const beforePricePPM = await curve.getCollateralPricePPM(daiAddress);
  const beforePrice = beforePricePPM.toNumber() / 1000000;
  console.log(`The price before buying is ${beforePrice}`);

  //   const tx = await curve
  //     .connect(buyer)
  //     .openBuyOrder(buyer.address, daiAddress, buyOrder);
  //   const receipt = await tx.wait();
  //   console.log("buyed");
  //   const event = receipt.events?.filter((x) => {
  //     return x.event == "OpenBuyOrder";
  //   });
  //   const batchId = event["0"]["args"]["batchId"];
  //   console.log(batchId);

  //   await progressToNextBatch();
  //   console.log("progressed");

  //   const initialPDGBalance = await token.balanceOf(buyer.address);
  //   console.log(
  //     `initialBalance ${await ethers.utils.formatEther(initialPDGBalance)}`
  //   );
  //   await curve.connect(buyer).claimBuyOrder(buyer.address, batchId, daiAddress);
  //   const finalPDGBalance = await token.balanceOf(buyer.address);
  //   console.log(
  //     `finalBalance ${await ethers.utils.formatEther(finalPDGBalance)}`
  //   );
  //   const tradePDGAmount = finalPDGBalance.sub(initialPDGBalance);
  //   const avgPrice =
  //     Number(ethers.utils.formatEther(buyOrder)) /
  //     Number(ethers.utils.formatEther(tradePDGAmount));
  //   const slippage = (avgPrice - beforePrice) / beforePrice;
  //   const totalSupply = await token.totalSupply();
  //   const totalReserve = await dai.balanceOf(curveAddress);
  //   const totalFees = await dai.balanceOf(deployer.address);
  //   const afterPricePPM = await curve.getCollateralPricePPM(daiAddress);
  //   const afterPrice = afterPricePPM.toNumber() / 1000000;
  //   const priceDelta = (afterPrice - beforePrice) / beforePrice;
  //   console.log(`The price after buying is; ${afterPrice}`);
  //   console.log(`The slippage was: ${slippage}`);
  //   console.log(`The total reserve is: ${totalReserve}`);
  //   console.log(`The total fees are: ${totalFees}`);
  //   console.log(`The price delta is: ${priceDelta}`);
  //   //check whetehr formatting the slipagge is right
  //   const dataToWriteFile =
  //     `The price after Buying is; ${afterPrice}` +
  //     `The total reserve is: ${ethers.utils.formatEther(totalReserve)}` +
  //     `The total fees are: ${ethers.utils.formatEther(totalFees)}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
