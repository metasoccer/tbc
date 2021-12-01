async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Token = await ethers.getContractFactory("MetaSoccerToken");
  const initialSupply = ethers.utils.parseEther('360000000');
  const token = await Token.deploy(deployer.address, initialSupply);

  console.log("Test Curve MSU address:", token.address);

  const Dai = await ethers.getContractFactory("TestDAI");
  const daiSupply = ethers.utils.parseEther('1000000000');
  const dai = await Dai.deploy(deployer.address, daiSupply);
  
  console.log("Test Curve DAIs address:", dai.address);

  const Formula = await ethers.getContractFactory("BancorFormula");
  const formula = await Formula.deploy();
  
  console.log("Bancor Formula address:", formula.address);

  const reserveRatio = 0.2;
  const blocksPerBatch = 5;
  const initialCurveLiquidity = 540000; // DAIs from public sale
  const targetInitialPrice = 0.035;
  const buyFee = ethers.utils.parseEther('0'); // 0.15% Buying Trading Fee
  const sellFee = ethers.utils.parseEther('0'); // 0.3% Buying Trading Fee
  const initialCurveSupply = initialCurveLiquidity / (targetInitialPrice * reserveRatio); // Value from model 61714285.71428571 OR 77.14285714285714, now calculated dynamically
  const formattedCurveSupply = ethers.utils.parseEther(initialCurveSupply.toString());
  const minCurveSupply = ethers.utils.parseEther('60000000');

  const Curve = await ethers.getContractFactory("BatchedBancorMarketMaker");
  const curve = await Curve.deploy(formula.address, token.address, deployer.address, formattedCurveSupply, minCurveSupply, blocksPerBatch, buyFee, sellFee)

  console.log("Curve address:", curve.address);
}
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });