const TokenContract = require("../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const { ethers } = require("hardhat");

async function main() {
  const [deployer, buyer] = await ethers.getSigners();
  console.log(buyer.address);

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
  const tokenAmount = ethers.utils.parseEther("10000000");
  const tokensToCurve = await token.transfer(curve.address, tokenAmount);
  tokensToCurve.wait(); //<---------------------------------NEW IMPLEMENTATION V8
  console.log("Address : " + curveAddress);

  //   await checkPDGCurveBalance();
  //   await checkDAICurveBalance();

  //checking the curve balances of PDG
  const balanceCurve = await token.balanceOf(curve.address);
  const formatedCurve = await ethers.utils.formatEther(balanceCurve);
  console.log(`The curve has ${formatedCurve} amount of PDG`);

  //checking the curve balances of DAI
  const balanceCurveDAI = await dai.balanceOf(curve.address);
  const formatedCurveDAI = await ethers.utils.formatEther(balanceCurveDAI);
  console.log(`The curve has ${formatedCurveDAI} amount of DAI`);

  //this shit here causes the problems
  //ERC20(_collateral).allowance(_buyer, address(this)) >= _value

  //solve?  dai.approve(address _spender, uint256 _amount)

  //try {

  // const currentBatch = await curve.getCurrentBatchId();
  // console.log(`The current batch is: ${currentBatch}`);

  console.log("changing collaterals slippage");
  await curve.updateCollateralToken(
    daiAddress,
    0,
    0,
    "500000",
    "30000000000000000"
  );
  console.log("slipage updated");

  //transfer dai to our buyer address
  console.log("Transfering dai to the buyer so they can buy");
  await dai.transfer(buyer.address, "100000");
  console.log("Connecting to buyer");
  //await buyer.connect(buyer);

  const buyOrder = ethers.utils.parseEther("100");

  //const buyOrder = "1000";

  const approval = await dai.connect(buyer).approve(curve.address, buyOrder);
  approval.wait();
  console.log(approval);

  const buySucceed = await curve.openBuyOrder(
    buyer.address,
    dai.address,
    buyOrder
  );
  buySucceed.wait();

  const currentBatch = await curve.getCurrentBatchId();
  console.log(`The current batch is: ${currentBatch}`);
  const batchToPass = currentBatch - 5;

  const claimSucceed = await curve.claimBuyOrder(
    buyer.address,
    batchToPass,
    daiAddress
  );
  //console.log(buySucceed.address);
  console.log("completed");
  //} catch (e) {
  //console.log(e.message);
  //throw e;
  //}

  //   function claimBuyOrder(address _buyer, uint256 _batchId, address _collateral) external nonReentrant {
  //     require(_collateralIsWhitelisted(_collateral),       ERROR_COLLATERAL_NOT_WHITELISTED);
  //     require(_batchIsOver(_batchId),                      ERROR_BATCH_NOT_OVER);
  //     require(!_batchIsCancelled(_batchId, _collateral),   ERROR_BATCH_CANCELLED);
  //     require(_userIsBuyer(_batchId, _collateral, _buyer), ERROR_NOTHING_TO_CLAIM);

  //     _claimBuyOrder(_buyer, _batchId, _collateral);
  // }

  //   function openBuyOrder(address _buyer, address _collateral, uint256 _value) external nonReentrant {
  //     require(isOpen,                                                          ERROR_NOT_OPEN);
  //     require(_collateralIsWhitelisted(_collateral),                           ERROR_COLLATERAL_NOT_WHITELISTED);
  //     require(!_batchIsCancelled(_currentBatchId(), _collateral),              ERROR_BATCH_CANCELLED);
  //     require(_collateralValueIsValid(_buyer, _collateral, _value), ERROR_INVALID_COLLATERAL_VALUE);

  //     _openBuyOrder(_buyer, _collateral, _value);
  // }
}

// async function checkPDGCurveBalance() {
//   const balanceCurve = await token.balanceOf(curve.address);
//   const formatedCurve = await ethers.utils.formatEther(balanceCurve);
//   console.log(`The curve has ${formatedCurve} amount of PDG`);
// }
// async function checkDAICurveBalance() {
//   const balanceCurveDAI = await dai.balanceOf(curve.address);
//   const formatedCurveDAI = await ethers.utils.formatEther(balanceCurveDAI);
//   console.log(`The curve has ${formatedCurveDAI} amount of DAI`);
// }
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
