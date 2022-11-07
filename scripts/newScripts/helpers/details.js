//remember to add the network
const TokenContract = require("../../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const { ethers } = require("hardhat");
const {
  daiAddress,
  tokenAddress,
  bancorAddress,
  curveAddress,
} = require("./addresses");

async function main() {
  const [deployer, buyer] = await ethers.getSigners();

  //contracts
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);

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
  console.log("Checking details of the collateral.....");
  const collateral = await curve.collaterals(daiAddress);
  const slippage = collateral.slippage;
  const reserveRatio = collateral.reserveRatio;
  const whitelisted = collateral.whitelisted;

  console.log(`Slippage: ${slippage}`);
  console.log(`Reserve Ratio: ${reserveRatio}`);
  console.log(`Whitelisted: ${whitelisted}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
