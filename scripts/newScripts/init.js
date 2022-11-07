const TokenContract = require("../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const {
  daiAddress,
  tokenAddress,
  bancorAddress,
  curveAddress,
} = require("./helpers/addresses");

async function main() {
  const [deployer, buyer] = await ethers.getSigners();

  const initialCurveLiquidity = 540000; //10000
  const reserveRatio = 0.2; //0.5
  const PPM = 1000000;
  const reserveRatioPPM = reserveRatio * PPM;
  const slippage = ethers.utils.parseEther(".3");

  console.log("\n** Paydirt Gold");
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  console.log("Address : " + tokenAddress);
  console.log("Name : " + (await token.name()));
  console.log(
    "Supply : " + ethers.utils.formatUnits(await token.totalSupply()) + " PDG"
  );

  console.log("\n** DAI");
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);
  console.log("Address : " + tokenAddress);
  console.log("Name : " + (await dai.name()));
  console.log(
    "Supply : " + ethers.utils.formatUnits(await dai.totalSupply()) + " DAI"
  );

  console.log("\n** Connect to Bonding Curve and update OPEN_ROLE");
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);
  console.log("Address : " + curveAddress);
  const OPEN_ROLE = await curve.OPEN_ROLE();
  let tx = await curve.grantRole(OPEN_ROLE, deployer.address);
  await tx.wait();

  console.log("\n** Update MINTER_ROLE");
  const MINTER_ROLE = token.MINTER_ROLE();
  tx = await token.grantRole(MINTER_ROLE, curve.address);
  await tx.wait();

  console.log("\n** Add initial collateral to the curve");
  tx = await dai.transfer(
    curveAddress,
    ethers.utils.parseEther(initialCurveLiquidity.toString())
  );
  await tx.wait();
  tx = await curve.addCollateralToken(
    daiAddress,
    ethers.BigNumber.from(0),
    ethers.BigNumber.from(0),
    reserveRatioPPM,
    slippage
  );
  tx = await curve.open(true);
  await tx.wait();
  console.log("Curve is open: " + (await curve.isOpen()));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
