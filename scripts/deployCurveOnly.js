async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const blocksPerBatch = 50;
  const buyFee = ethers.utils.parseEther('0.002'); // 0.2% Buying Trading Fee
  const sellFee = ethers.utils.parseEther('0.003'); // 0.3% Buying Trading Fee
  const formattedCurveSupply = BigInt("118631941129017935042548644"); // Take from latest deployed curve
  const minCurveSupply = ethers.utils.parseEther('60000000');
  const formulaAddress = "0x780017A34e0175F8bD3810B71A58Bd1C2C005911";
  const tokenAddress = "0xcb016D39cd7608c37f1D8f4192Ec103242Bc456d";

  const Curve = await ethers.getContractFactory("BatchedBancorMarketMaker");
  const curve = await Curve.deploy(formulaAddress, tokenAddress, deployer.address, formattedCurveSupply, minCurveSupply, blocksPerBatch, buyFee, sellFee);

  console.log("Curve address:", curve.address);
}
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });