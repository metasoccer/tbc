const TokenContract = require("../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const { ethers } = require("hardhat");

async function main() {
  const wallets = await ethers.getSigners();
  this.PAYDIRTDAO = wallets[0];
  this.minter = wallets[1];
  this.pauser = wallets[2];
  this.treasury = wallets[3];
  this.MARC = wallets[4];
  this.COREY = wallets[5];
  this.charlie = wallets[6];

  const daiAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const curveAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const bancorAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

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
  console.log("Address : " + curveAddress);

  const balanceCurve = await token.balanceOf(curve.address);
  const formatedCurve = await ethers.utils.formatEther(balanceCurve);
  console.log(`The curve has ${formatedCurve} amount of PDG`);

  const balanceCurveDAI = await dai.balanceOf(curve.address);
  const formatedCurveDAI = await ethers.utils.formatEther(balanceCurveDAI);
  console.log(`The curve has ${formatedCurveDAI} amount of DAI`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
