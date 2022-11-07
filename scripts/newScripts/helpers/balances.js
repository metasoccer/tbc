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

  console.log(
    "********************************WALLETS*************************************\n"
  );
  console.log(`We are owning/managing with: ${deployer.address}`);
  console.log(`We are buying with: ${buyer.address}`);

  console.log("\n** Paydirt Gold");
  const balance = await token.balanceOf(deployer.address);
  const formatedPDG = await ethers.utils.formatEther(balance);
  const balanceBuyer = await token.balanceOf(buyer.address);
  const formatedPDGBuyer = await ethers.utils.formatEther(balanceBuyer);
  const balanceCurve = await token.balanceOf(curve.address);
  const formatedCurve = await ethers.utils.formatEther(balanceCurve);
  console.log(`The curve has ${formatedCurve} amount of PDG`);
  console.log(`we have ${formatedPDG} amount of PDG`);
  console.log(`The buyer has ${formatedPDGBuyer} amount of PDG`);

  console.log("\n** DAI");
  const balanceDAI = await dai.balanceOf(deployer.address);
  const formatedDAI = await ethers.utils.formatEther(balanceDAI);
  const balanceDAIBuyer = await dai.balanceOf(buyer.address);
  const formatedDAIBuyer = await ethers.utils.formatEther(balanceDAIBuyer);
  const balanceCurveDAI = await dai.balanceOf(curve.address);
  const formatedCurveDAI = await ethers.utils.formatEther(balanceCurveDAI);
  console.log(`The curve has ${formatedCurveDAI} amount of DAI`);
  console.log(`We have ${formatedDAI} amount of DAI`);
  console.log(`Buyer has ${formatedDAIBuyer} amount of DAI`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
