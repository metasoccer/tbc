const TokenContract = require("../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const { ethers } = require("hardhat");

const blocksPerBatch = 20; //20 //5?? //15 =  300seconds
// Helpers
const openAndClaimBuyOrder =
  require("../../test/helpers/utils").openAndClaimBuyOrder(
    this,
    blocksPerBatch
  );
const openAndClaimSellOrder =
  require("../../test/helpers/utils").openAndClaimSellOrder(
    this,
    blocksPerBatch
  );
const progressToNextBatch =
  require("../../test/helpers/utils").progressToNextBatch(blocksPerBatch);

async function main() {
  const [deployer] = await ethers.getSigners();

  const daiAddress = "0x237F2756fcf7F6110FDb84D1a143D96C1b80ED11";
  const tokenAddress = "0x413A315912c49796Ad02679DD26D57Eb90720f8F";
  const curveAddress = "0x02c31AF09Bd189fab6a2Db9B72DD858FBBF4236e";
  const bancorAddress = "0x0B4D23e0F8c926501F364C8931E0dfFbeA8419DA";

  console.log("\n** Paydirt Gold");
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  console.log("Address : " + tokenAddress);
  console.log("Name : " + (await token.name()));
  console.log(
    "Supply : " + ethers.utils.formatUnits(await token.totalSupply()) + " PDG"
  );

  const balance = await token.balanceOf(deployer.address);
  const formatedPDG = await ethers.utils.formatEther(balance);
  console.log(`We have ${formatedPDG} amount of PDG`);

  console.log("\n** DAI");
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);
  console.log("Address : " + tokenAddress);
  console.log("Name : " + (await dai.name()));
  console.log(
    "Supply : " + ethers.utils.formatUnits(await dai.totalSupply()) + " DAI"
  );
  const balanceDAI = await dai.balanceOf(deployer.address);
  const formatedDAI = await ethers.utils.formatEther(balanceDAI);
  console.log(`We have ${formatedDAI} amount of DAI`);

  console.log("\n** Connect to Bonding Curve");
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);

  console.log("transfering PDG to the curve......");
  const tAmount = ethers.utils.parseEther("100000");
  const t = await token.transfer(curve.address, tAmount);
  t.wait(); //<---------------------------------NEW IMPLEMENTATION V8
  console.log("Address : " + curveAddress);

  const balanceCurve = await token.balanceOf(curve.address);
  const formatedCurve = await ethers.utils.formatEther(balanceCurve);
  console.log(`The curve has ${formatedCurve} amount of PDG`);

  //checking the curve balances of DAI
  const balanceCurveDAI = await dai.balanceOf(curve.address);
  const formatedCurveDAI = await ethers.utils.formatEther(balanceCurveDAI);
  console.log(`The curve has ${formatedCurveDAI} amount of DAI`);

  const buyOrder = ethers.utils.parseEther("100");

  const approval = await dai.approve(curve.address, buyOrder);
  console.log(approval);

  console.log("changing collaterals slippage");
  await curve.updateCollateralToken(
    daiAddress,
    0,
    0,
    "500000",
    "30000000000000000"
  );
  console.log("slipage updated");

  const buySucceed = await openAndClaimBuyOrder(
    deployer.address,
    daiAddress,
    buyOrder
  );
  console.log(buySucceed);

  //console.log(buySucceed.address);
  console.log("completed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
