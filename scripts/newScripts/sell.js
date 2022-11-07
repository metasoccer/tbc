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

async function main() {
  //wallets
  const [deployer, buyer] = await ethers.getSigners();

  //contracts
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);

  const buyerBalance = await token.balanceOf(buyer.address);
  const formatedBuyerBalance = await ethers.utils.formatEther(buyerBalance);
  console.log(`The buyer has ${formatedBuyerBalance} PDG`);
  //console.log();

  const sellOrder = ethers.utils.parseEther("1000");
  await token.connect(buyer).approve(curve.address, sellOrder);
  console.log(`Sell value approved to the curve`);

  const beforePricePPM = await curve.getCollateralPricePPM(daiAddress);
  const beforePrice = beforePricePPM.toNumber() / 1000000;
  console.log(`The price before selling is ${beforePrice}`);

  //OPEN SELL ORDER
  const tx = await curve
    .connect(buyer)
    .openSellOrder(buyer.address, daiAddress, sellOrder);
  const receipt = await tx.wait();
  console.log("selled");
  const event = receipt.events?.filter((x) => {
    return x.event == "OpenSellOrder";
  });
  const batchId = event["0"]["args"]["batchId"];
  console.log(batchId);

  //PROGRESSING
  //check it also
  await progressToNextBatch();
  //await progressToNextBatch(blocksPerBatch)();
  //await progressToNextBatch();
  console.log("progressed");

  const initialPDGBalance = await token.balanceOf(buyer.address);
  //initialPDGBalance.wait();
  console.log(`initialBalance ${initialPDGBalance}`);
  await curve.connect(buyer).claimSellOrder(buyer.address, batchId, daiAddress);
  const finalPDGBalance = await token.balanceOf(buyer.address);
  console.log(`finalBalance ${finalPDGBalance}`);
  const tradePDGAmount = finalPDGBalance.sub(initialPDGBalance);
  const avgPrice =
    Number(ethers.utils.formatEther(buyOrder)) /
    Number(ethers.utils.formatEther(tradePDGAmount));
  const slippage = (avgPrice - beforePrice) / beforePrice;
  const totalSupply = await token.totalSupply();
  const totalReserve = await dai.balanceOf(curveAddress);
  const totalFees = await dai.balanceOf(deployer.address);
  const afterPricePPM = await curve.getCollateralPricePPM(daiAddress);
  const afterPrice = afterPricePPM.toNumber() / 1000000;
  const priceDelta = (afterPrice - beforePrice) / beforePrice;
  console.log(`The price after Selling is; ${afterPrice}`);
  console.log(`The slippage was: ${slippage}`);
  console.log(`The total reserve is: ${totalReserve}`);
  console.log(`The total fees are: ${totalFees}`);
  console.log(`The price delta is: ${priceDelta}`);
  const dataToWriteFile =
    `The price after Selling is; ${afterPrice}` +
    `The slippage was: ${slippage}` +
    `The total reserve is: ${totalReserve}` +
    `The total fees are: ${totalFees}` +
    `The price delta is: ${priceDelta}`;

  fs.appendFile(
    path.join(__dirname, "logs", "sellOrders.txt"),
    dataToWriteFile,
    function (err) {
      if (err) throw err;
      console.log("Saved sell order in logs!");
    }
  );

  /**
   * (test, blocksPerBatch) => async (from, collateral, amount) => {
    const beforePricePPM = await test.curve.getCollateralPricePPM(collateral);
    const beforePrice = beforePricePPM.toNumber() / 1000000;
    const tx = await test.curve
      .connect(from)
      .openSellOrder(from.address, collateral, amount);
    const receipt = await tx.wait();
    const event = receipt.events?.filter((x) => {
      return x.event == "OpenSellOrder";
    });
    const batchId = event["0"]["args"]["batchId"];

    await progressToNextBatch(blocksPerBatch)();

    const initialBalance = await test.dai.balanceOf(from.address);
    await test.curve
      .connect(from)
      .claimSellOrder(from.address, batchId, collateral);
    const finalBalance = await test.dai.balanceOf(from.address);
    const tradeAmount = finalBalance.sub(initialBalance);
    const avgPrice =
      Number(ethers.utils.formatEther(tradeAmount)) /
      Number(ethers.utils.formatEther(amount));
    const slippage = (avgPrice - beforePrice) / beforePrice;
    const totalSupply = await test.token.totalSupply();
    const totalReserve = await test.dai.balanceOf(test.curve.address);
    const totalFees = await test.dai.balanceOf(test.admin.address);
    const afterPricePPM = await test.curve.getCollateralPricePPM(collateral);
    const afterPrice = afterPricePPM.toNumber() / 1000000;
    const priceDelta = (afterPrice - beforePrice) / beforePrice;
   */
}

const progressToNextBatch = (blocksPerBatch) => async () => {
  console.log("getting the current block");
  const currentBlock = await network.provider.send("eth_blockNumber");
  console.log("calculating current batch");
  const currentBatch =
    Math.floor(currentBlock / blocksPerBatch) * blocksPerBatch;
  const blocksUntilNextBatch = currentBatch + blocksPerBatch - currentBlock;
  console.log("blocks until next batch calculated");

  console.log("start", await ethers.provider.send("eth_blockNumber"));
  //await network.provider.send("evm_mine", [{ blocks: blocksUntilNextBatch }]); // mines 5 blocks

  for (let i = 0; i < blocksUntilNextBatch; i++) {
    console.log(i);
    await ethers.provider.send("evm_mine");
  }
  console.log("end", await ethers.provider.send("eth_blockNumber"));
  console.log("succeed");
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
