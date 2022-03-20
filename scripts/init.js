const TokenContract = require('../artifacts/contracts/BlastRoyaleToken.sol/BlastRoyaleToken.json');
const DaiContract = require('../artifacts/contracts/TestDAI.sol/TestDAI.json');
const CurveContract = require('../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json');

async function main() {
  const [deployer] = await ethers.getSigners();
  const daiAddress = '0x4a0e5c394F130ac5994b3C83d66Cc4651616C248';
  const tokenAddress = '0x84693083Df3139781218e78f0f9142e9537037b9';
  const curveAddress = '0x603Fa164Ca1774010e56bd98d6Ff5457D2Ec0CD8';
  const bancorAddress = '0x9797320DB23CEc292Ed9E6E436C49b22A89a4970';
  const initialCurveLiquidity = 540000;
  const reserveRatio = 0.25;
  const PPM = 1000000;
  const reserveRatioPPM = reserveRatio * PPM;
  const slippage = ethers.utils.parseEther('.1');

  console.log('\n** BlastRoyaleToken');
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  console.log('Address : ' + tokenAddress);
  console.log('Name : ' + (await token.name()));
  console.log('Supply : ' + (ethers.utils.formatUnits(await token.totalSupply())) + ' TBLT');

  console.log('\n** DAI');
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);
  console.log('Address : ' + tokenAddress);
  console.log('Name : ' + (await dai.name()));
  console.log('Supply : ' + (ethers.utils.formatUnits(await dai.totalSupply())) + ' DAI');

  console.log('\n** Connect to Bonding Curve and update OPEN_ROLE');
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);
  console.log('Address : ' + curveAddress);
  const OPEN_ROLE = await curve.OPEN_ROLE();
  let tx = await curve.grantRole(OPEN_ROLE, deployer.address);
  await tx.wait();

  console.log('\n** Update MINTER_ROLE')
  const MINTER_ROLE = token.MINTER_ROLE();
  tx = await token.grantRole(MINTER_ROLE, curve.address);
  await tx.wait();

  console.log('\n** Add initial collateral to the curve');
  tx = await token.transfer(curveAddress, ethers.utils.parseEther(initialCurveLiquidity.toString()));
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
  console.log('Curve is open: ' + (await curve.isOpen()));

}
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
