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
  //wallets
  const [deployer, buyer] = await ethers.getSigners();

  //contracts
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);

  const PricePPM = await curve.getCollateralPricePPM(daiAddress);
  const Price = PricePPM.toNumber() / 1000000;
  console.log(`The price is ${Price}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
