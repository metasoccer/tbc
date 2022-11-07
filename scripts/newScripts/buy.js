const TokenContract = require("../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const { ethers, network, hardhatArguments } = require("hardhat");
//const ethers = require("ethers");
const {
  daiAddress,
  tokenAddress,
  bancorAddress,
  curveAddress,
} = require("./helpers/addresses");
const fs = require("fs");
const path = require("path");

const blocksPerBatch = 20; //20 //5?? //15 =  300seconds

// const openAndClaimBuyOrder =
//   require("./utils").openAndClaimBuyOrder(blocksPerBatch);
// const openAndClaimSellOrder =
//   require("./utils").openAndClaimSellOrder(blocksPerBatch);
// const progressToNextBatch =
//   require("./utils").progressToNextBatch(blocksPerBatch);

async function main() {
  //wallets
  const [deployer, buyer] = await ethers.getSigners();

  //contracts
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);

  //transfer dai to our buyer address
  // console.log("Transfering dai to the buyer so they can buy");
  // const transferDaiToBuyer = await dai.transfer(buyer.address, "1000");
  // transferDaiToBuyer.wait();
  // console.log("DAI transfered to the buyer");

  console.log("Connecting to buyer and approving the DAI to the curve");
  const buyOrder = ethers.utils.parseEther("500");
  //const buyOrder = "1000";
  const approval = await dai.connect(buyer).approve(curve.address, buyOrder);
  approval.wait();

  //opening buy order
  //const buySucceed = await curve.connect(buyer);
  //await openAndClaimBuyOrder(buyer.address, daiAddress, buyOrder);
  //     .openBuyOrder(buyer.address, dai.address, buyOrder);
  //   buySucceed.wait();
  //console.log("BUYED");

  const beforePricePPM = await curve.getCollateralPricePPM(daiAddress);
  const beforePrice = beforePricePPM.toNumber() / 1000000;
  console.log(`The price before buying is ${beforePrice}`);

  const tx = await curve
    .connect(buyer)
    .openBuyOrder(buyer.address, daiAddress, buyOrder);
  const receipt = await tx.wait();
  console.log("buyed");
  const event = receipt.events?.filter((x) => {
    return x.event == "OpenBuyOrder";
  });
  const batchId = event["0"]["args"]["batchId"];
  console.log(batchId);

  await progressToNextBatch(blocksPerBatch)();
  //await progressToNextBatch();
  console.log("progressed");

  const initialPDGBalance = await token.balanceOf(buyer.address);
  console.log(
    `initialBalance ${await ethers.utils.formatEther(initialPDGBalance)}`
  );
  //we are passing the same batchId and it has to be
  await curve.connect(buyer).claimBuyOrder(buyer.address, batchId, daiAddress);
  const finalPDGBalance = await token.balanceOf(buyer.address);
  console.log(
    `finalBalance ${await ethers.utils.formatEther(finalPDGBalance)}`
  );
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
  console.log(`The price after buying is; ${afterPrice}`);
  console.log(`The slippage was: ${slippage}`);
  console.log(`The total reserve is: ${totalReserve}`);
  console.log(`The total fees are: ${totalFees}`);
  console.log(`The price delta is: ${priceDelta}`);
  //check whetehr formatting the slipagge is right
  const dataToWriteFile =
    `The price after Buying is; ${afterPrice}` +
    `The total reserve is: ${ethers.utils.formatEther(totalReserve)}` +
    `The total fees are: ${ethers.utils.formatEther(totalFees)}`;

  fs.appendFile(
    path.join(__dirname, "logs", "buyOrders.txt"),
    dataToWriteFile,
    function (err) {
      if (err) throw err;
      console.log("Saved sell order in logs!");
    }
  );
}

// const progressToNextBatch = (blocksPerBatch) => async () => {
//   console.log("getting the current block");
//   const currentBlock = await hre.ethers.provider.send("eth_blockNumber");
//   console.log("calculating current batch");
//   const currentBatch =
//     Math.floor(currentBlock / blocksPerBatch) * blocksPerBatch;
//   const blocksUntilNextBatch = currentBatch + blocksPerBatch - currentBlock;
//   console.log("blocks until next batch calculated");

//   console.log("start", await hre.ethers.provider.send("eth_blockNumber"));
//   //await network.provider.send("evm_mine", [{ blocks: blocksUntilNextBatch }]); // mines 5 blocks

//   for (let i = 0; i < blocksUntilNextBatch; i++) {
//     //console.log(i);
//     await hre.ethers.provider.send("evm_mine");
//   }
//   console.log("end", await hre.ethers.provider.send("eth_blockNumber"));
//   console.log("succeed");
// };
const progressToNextBatch = (blocksPerBatch) => async () => {
  //take out the key in production
  // const provider = new ethers.providers.JsonRpcProvider(
  //   "https://polygon-mumbai.infura.io/v3/beae48ddf884493687b786b6ef241311"
  // );

  //TEST IN HARDHAT BECAUSE IN THE LOCAL THEY PROVABLY DON'T NEED THE EVM
  const provider = new ethers.providers.JsonRpcProvider(
    "https://polygon-mumbai.g.alchemy.com/v2/8gIA1F_rlhhHEOO8VN-aZuZd4N069h-6"
  );
  const currentBlock = await provider.send("eth_blockNumber");
  const currentBatch =
    Math.floor(currentBlock / blocksPerBatch) * blocksPerBatch;
  const blocksUntilNextBatch = currentBatch + blocksPerBatch - currentBlock;
  for (var i = 0; i < blocksUntilNextBatch; i++) {
    await provider.send("evm_mine");
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
