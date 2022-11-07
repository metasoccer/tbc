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

const openAndClaimBuyOrder = require("./helpers/utilsM").openAndClaimBuyOrder(
  this,
  blocksPerBatch
);
const openAndClaimSellOrder =
  require("./helpers/utilsM").openAndClaimSellOrder(blocksPerBatch);
const progressToNextBatch =
  require("./helpers/utilsM").progressToNextBatch(blocksPerBatch);

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

  const beforePricePPM = await curve.getCollateralPricePPM(daiAddress);
  const beforePrice = beforePricePPM.toNumber() / 1000000;
  console.log(`The price before buying is ${beforePrice}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
