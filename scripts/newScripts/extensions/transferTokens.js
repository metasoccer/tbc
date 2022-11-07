const TokenContract = require("../../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const { ethers } = require("hardhat");
const {
  daiAddress,
  tokenAddress,
  bancorAddress,
  curveAddress,
} = require("../helpers/addresses");

async function main() {
  const [deployer, buyer] = await ethers.getSigners();

  //contracts
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);

  //transfer PAYDIRT GOLD
  //FROM DEPLOYER
  //to the buyer
  const tokenAmount = ethers.utils.parseEther("1000000"); //<-- 1 million
  const success = await token
    .connect(deployer)
    .transfer(buyer.address, tokenAmount);
  success.wait();

  // //to the curve
  // await token.transfer(curveAddress, tokenAmount);

  // //FROM BUYER
  // //to the deployer
  // const BuyerAmount = "100000"; //<-- 100_000
  // await token.connect(buyer.address).transfer(deployer.address, BuyerAmount);

  //to the curve
  //await token.connect(buyer.address).transfer(curveAddress, BuyerAmount);

  //transfer DAI/USDC
  //from deployer
  //to the buyer
  const DAIAmount = ethers.utils.parseEther("100000"); //<-- 100k
  const transferDAIToBuyer = await dai.transfer(buyer.address, DAIAmount);
  transferDAIToBuyer.wait();
  console.log("transfered");
  //to the address
  //await dai.transfer(curveAddress, DAIAmount);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
