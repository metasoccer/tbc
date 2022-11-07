async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  //it gives matic/eth balance
  console.log("Account balance:", (await deployer.getBalance()).toString());

  //WHY 50??
  const blocksPerBatch = 50;

  //fees that are charged each time someone buys and sells
  const buyFee = ethers.utils.parseEther("0.002"); // 0.2% Buying Trading Fee
  const sellFee = ethers.utils.parseEther("0.003"); // 0.3% Buying Trading Fee

  //WHAT IS THIS
  const formattedCurveSupply = BigInt("118631941129017935042548644"); // Take from latest deployed curve

  //WHat did you base in to calculate the initial supply? To get to a certain price?
  const minCurveSupply = ethers.utils.parseEther("60000000");
  const formulaAddress = "0xB3c2653748b47Ce71AF5f20589d34dAbdc34fB4F";
  const tokenAddress = "0x308Ae97773A0a4aF4b7460A9960b25E50E5e2C5f";

  const Curve = await ethers.getContractFactory("BatchedBancorMarketMaker");
  const curve = await Curve.deploy(
    formulaAddress,
    tokenAddress,
    deployer.address,
    formattedCurveSupply,
    minCurveSupply,
    blocksPerBatch,
    buyFee,
    sellFee
  );

  console.log("Curve address:", curve.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
