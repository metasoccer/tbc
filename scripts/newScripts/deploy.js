async function main() {
  //deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  const Balance = await deployer.getBalance();
  const formatedB = await ethers.utils.formatEther(Balance);
  console.log(formatedB + " Matic");

  //paydirt gold
  const Token = await ethers.getContractFactory("PaydirtGold");
  //^^^^^^ASK COREY THE INITIAL SUPLLY^^^^^^^^^ 200 million total before bonding
  const initialSupply = ethers.utils.parseEther("200000000");
  const name = "Paydirt Gold";
  const symbol = "PDG";
  const token = await Token.deploy(
    deployer.address,
    initialSupply,
    name,
    symbol
  );
  console.log("Paydirt Gold address:", token.address);

  //dai
  const Dai = await ethers.getContractFactory("TestDAI");
  const daiSupply = ethers.utils.parseEther("1000000000");
  const dai = await Dai.deploy(deployer.address, daiSupply);
  console.log("Test Curve DAIs address:", dai.address);

  //formula
  const Formula = await ethers.getContractFactory("BancorFormula");
  const formula = await Formula.deploy();
  console.log("Bancor Formula address:", formula.address);

  /**The Reserve Ratio is expressed as a percentage greater than 0% and up to 100%.
   * The Reserve Ratio represents a fixed ratio between the Continuous Token's total value
   * (total supply × unit price) and the value of its Reserve Token balance.
   *
   * Reserve Ratio = Reserve Token Balance / (Continuous Token Supply x Continuous Token Price)
   * Check
   * https://yos.io/2018/11/10/bonding-curves/#:~:text=The%20Reserve%20Ratio%20is%20expressed,of%20its%20Reserve%20Token%20balance.
   * */

  //THINK THIS IS 25% for metasoccer, There are projects using 40% also
  //we are using 20%
  const reserveRatio = 0.2; //0.5

  //to disable sniping bots
  const blocksPerBatch = 20; //5

  //SHOULD WE ADD THE 10k COREY SAID
  //Mainnet 480K
  //Test: 10k from Corey
  const initialCurveLiquidity = 540000; // USDC from Corey

  /**Bancor Formula
   *
   * Continuous Token Price = Reserve Token Balance / (Continuous Token Supply x Reserve Ratio)
   *
   * PurchaseReturn = ContinuousTokenSupply * ((1 + ReserveTokensReceived / ReserveTokenBalance) ^ (ReserveRatio) - 1)
   *
   * SaleReturn = ReserveTokenBalance * (1 - (1 - ContinuousTokensReceived / ContinuousTokenSupply) ^ (1 / (ReserveRatio)))
   * */

  //OUR PRICE SHOULD BE 0.08$, metasoccer 0.035$
  const targetInitialPrice = 0.035;

  const buyFee = ethers.utils.parseEther("0.0015"); // 0.15% Buying Trading Fee
  const sellFee = ethers.utils.parseEther("0.003"); // 0.3% Buying Trading Fee

  //inital curves supply says Corey 200million

  //250.000 PDG at the numbers corey says
  const initialCurveSupply =
    initialCurveLiquidity / (targetInitialPrice * reserveRatio); // Value from model 61714285.71428571 OR 77.14285714285714, now calculated dynamically
  const formattedCurveSupply = ethers.utils.parseEther(
    initialCurveSupply.toString()
  );
  //CHECK AGAIN
  const minCurveSupply = ethers.utils.parseEther("60000000");

  const Curve = await ethers.getContractFactory("BatchedBancorMarketMaker");
  const curve = await Curve.deploy(
    formula.address,
    token.address,
    deployer.address,
    formattedCurveSupply,
    minCurveSupply,
    blocksPerBatch,
    buyFee,
    sellFee
  );
  await curve.deployed();
  console.log("Curve address:", curve.address);
  console.log("successfully deployed the contracts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
