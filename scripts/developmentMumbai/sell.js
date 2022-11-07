const TokenContract = require("../../artifacts/contracts/PaydirtGold.sol/PaydirtGold.json");
const DaiContract = require("../../artifacts/contracts/TestDAI.sol/TestDAI.json");
const CurveContract = require("../../artifacts/contracts/BatchedBancorMarketMaker.sol/BatchedBancorMarketMaker.json");
const { ethers } = require("hardhat");

async function main() {
  const [deployer, buyer] = await ethers.getSigners();
  console.log(deployer.address);

  const daiAddress = "0x237F2756fcf7F6110FDb84D1a143D96C1b80ED11";
  const tokenAddress = "0x413A315912c49796Ad02679DD26D57Eb90720f8F";
  const curveAddress = "0x02c31AF09Bd189fab6a2Db9B72DD858FBBF4236e";
  const bancorAddress = "0x0B4D23e0F8c926501F364C8931E0dfFbeA8419DA";

  console.log("\n** Paydirt Gold");
  const token = new ethers.Contract(tokenAddress, TokenContract.abi, deployer);
  console.log("Address : " + tokenAddress);
  console.log("Name : " + (await token.name()));
  console.log(
    "Supply : " + ethers.utils.formatUnits(await token.totalSupply()) + " PDG"
  );

  const balance = await token.balanceOf(deployer.address);
  const formatedPDG = await ethers.utils.formatEther(balance);
  console.log(`We have ${formatedPDG} amount of PDG BEFORE SELLING`);

  console.log("\n** DAI");
  const dai = new ethers.Contract(daiAddress, DaiContract.abi, deployer);
  console.log("Address : " + tokenAddress);
  console.log("Name : " + (await dai.name()));
  console.log(
    "Supply : " + ethers.utils.formatUnits(await dai.totalSupply()) + " DAI"
  );
  const balanceDAI = await dai.balanceOf(deployer.address);
  const formatedDAI = await ethers.utils.formatEther(balanceDAI);
  console.log(`We have ${formatedDAI} amount of DAI  BEFORE SELLING`);

  console.log("\n** Connect to Bonding Curve");
  const curve = new ethers.Contract(curveAddress, CurveContract.abi, deployer);

  console.log("Address : " + curveAddress);

  const balanceCurve = await token.balanceOf(curve.address);
  const formatedCurve = await ethers.utils.formatEther(balanceCurve);
  console.log(`The curve has ${formatedCurve} amount of PDG BEFORE SELLING`);

  const balanceCurveDAI = await dai.balanceOf(curve.address);
  const formatedCurveDAI = await ethers.utils.formatEther(balanceCurveDAI);
  console.log(`The curve has ${formatedCurveDAI} amount of DAI BEFORE SELLING`);

  //const balanceBefore =await token.balanceOf(deployer.address);
  const approval = await token.approve(curve.address, "100");
  await curve.updateCollateralToken(
    daiAddress,
    0,
    0,
    "200000",
    "300000000000000000"
  );
  //we need 30% slippage if not reverts

  /**
   * function _slippageIsValid(Batch storage _batch) internal view returns (bool) {
        uint256 staticPricePPM = _staticPricePPM(_batch.supply, _batch.balance, _batch.reserveRatio);
        uint256 maximumSlippage = _batch.slippage;

        // if static price is zero let's consider that every slippage is valid
        if (staticPricePPM == 0) {
            return true;
        }

        return _buySlippageIsValid(_batch, staticPricePPM, maximumSlippage) && _sellSlippageIsValid(_batch, staticPricePPM, maximumSlippage);
    }

    function _buySlippageIsValid(Batch storage _batch, uint256 _startingPricePPM, uint256 _maximumSlippage) internal view returns (bool) {
        /**
         * NOTE
         * the case where starting price is zero is handled
         * in the meta function _slippageIsValid()
        */

  /**
   * NOTE
   * slippage is valid if:
   * totalBuyReturn >= totalBuySpend / (startingPrice * (1 + maxSlippage))
   * totalBuyReturn >= totalBuySpend / ((startingPricePPM / PPM) * (1 + maximumSlippage / PCT_BASE))
   * totalBuyReturn >= totalBuySpend / ((startingPricePPM / PPM) * (1 + maximumSlippage / PCT_BASE))
   * totalBuyReturn >= totalBuySpend / ((startingPricePPM / PPM) * (PCT + maximumSlippage) / PCT_BASE)
   * totalBuyReturn * startingPrice * ( PCT + maximumSlippage) >= totalBuySpend * PCT_BASE * PPM
   */
  // if (
  //         _batch.totalBuyReturn.mul(_startingPricePPM).mul(PCT_BASE.add(_maximumSlippage)) >=
  //         _batch.totalBuySpend.mul(PCT_BASE).mul(uint256(PPM))
  //     ) {
  //         return true;
  //     }

  //     return false;
  // }

  console.log("slipage updated");
  await curve.openSellOrder(deployer.address, daiAddress, "1000");
  console.log("success");

  //AFTER SELLING
  const balanceCurveA = await token.balanceOf(curve.address);
  const formatedCurveA = await ethers.utils.formatEther(balanceCurveA);
  console.log(`The curve has ${formatedCurveA} amount of PDG A SELLING`);

  const balanceCurveDAIA = await dai.balanceOf(curve.address);
  const formatedCurveDAIA = await ethers.utils.formatEther(balanceCurveDAIA);
  console.log(`The curve has ${formatedCurveDAIA} amount of DAI A SELLING`);

  const balanceA = await token.balanceOf(deployer.address);
  const formatedPDGA = await ethers.utils.formatEther(balanceA);
  console.log(`We have ${formatedPDGA} amount of PDG A SELLING`);

  const balanceDAIA = await dai.balanceOf(deployer.address);
  const formatedDAIA = await ethers.utils.formatEther(balanceDAIA);
  console.log(`We have ${formatedDAIA} amount of DAI  A SELLING`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
