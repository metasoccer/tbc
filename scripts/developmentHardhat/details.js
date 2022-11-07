//remember to add the network
const TokenContract = require("../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const daiAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const curveAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const bancorAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  //console.log(deployer.address);
  //BALANCE
  console.log("%%%%%%%%%%%%%  Checking Balances  %%%%%%%%%%%\n");
  console.log("******************Wallet Balances************\n");
  //PDG
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  const balance = await token.balanceOf(deployer.address);
  const formatedPDG = await ethers.utils.formatEther(balance);
  console.log(`We have ${formatedPDG} amount of PDG\n`);
  //USDC/COLLATERAL
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);
  const balanceDAI = await dai.balanceOf(deployer.address);
  const formatedDAI = await ethers.utils.formatEther(balanceDAI);
  console.log(`We have ${formatedDAI} amount of DAI\n`);

  //CURVE
  console.log("******************Curve Balances************\n");
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);
  //PDG
  const balanceCurve = await token.balanceOf(curve.address);
  const formatedCurve = await ethers.utils.formatEther(balanceCurve);
  console.log(`The curve has ${formatedCurve} amount of PDG\n`);
  //USDC COLLATERAL
  const balanceCurveDAI = await dai.balanceOf(curve.address);
  const formatedCurveDAI = await ethers.utils.formatEther(balanceCurveDAI);
  console.log(`The curve has ${formatedCurveDAI} amount of DAI\n`);

  console.log("%%%%%%%%%%%%%  PDG DETAILS  %%%%%%%%%%%\n");
  console.log(`Address :  ${tokenAddress}\n`);
  console.log(`Name : ${await token.name()}\n`);
  console.log(`Name : ${await token.symbol()}\n`);
  console.log(`Decimals : ${await token.decimals()}\n`);
  console.log(
    `Supply : ${ethers.utils.formatUnits(await token.totalSupply())}  PDG\n`
  );
  console.log(`Is it paused??? : ${await token.paused()}\n`);

  console.log(`*****************Check Roles***************\n`);
  console.log(`*****************PAYDIRT WALLET***************\n`);
  const MINTER_ROLE =
    "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
  const PAUSER_ROLE =
    "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";
  console.log(
    `Do we have a minter role? : ${await token.hasRole(
      MINTER_ROLE,
      deployer.address
    )}\n`
  );
  console.log(
    `Do we have a pauser role? : ${await token.hasRole(
      PAUSER_ROLE,
      deployer.address
    )}\n`
  );
  console.log(`*****************BONDING CURVE***************\n`);
  console.log(
    `Does the curve have a minter role? : ${await token.hasRole(
      MINTER_ROLE,
      curveAddress
    )}\n`
  );
  console.log(
    `Does the curve have a pauser role? : ${await token.hasRole(
      PAUSER_ROLE,
      curveAddress
    )}\n`
  );
  /**CURVEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE */
  console.log("%%%%%%%%%%%%%  CURVE DETAILS  %%%%%%%%%%%\n");
  console.log(
    `Beneficiary (The address to whom the fees go to): ${await curve.beneficiary()}\n`
  );
  console.log(`Batch Blocks: ${await curve.batchBlocks()}\n`);
  console.log(`Current Batch ID: ${await curve.getCurrentBatchId()}\n`);
  console.log(`Buy Fee: ${await curve.buyFeePct()}\n`);
  console.log(`Sell Fee: ${await curve.sellFeePct()}\n`);
  console.log(`Curve Supply: ${await curve.curveSupply()}\n`);
  console.log(`Is the curve Open: ${await curve.isOpen()}\n`);
  console.log(
    `The tokens that have to be minted: ${await curve.tokensToBeMinted()}\n`
  );
  const OPEN_ROLE =
    "0xefa06053e2ca99a43c97c4a4f3d8a394ee3323a8ff237e625fba09fe30ceb0a4";
  console.log(
    `Does Paydirt have the Open Role? ${await curve.hasRole(
      OPEN_ROLE,
      deployer.address
    )}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
