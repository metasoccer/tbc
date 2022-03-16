const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");


// Project Constants
const initialSupply = ethers.utils.parseEther('360000000');
const initialCurveLiquidity = 540000; // DAIs from public sale
const targetInitialPrice = 0.035;
const reserveRatio = 0.20;

// Test Variables
const blocksPerBatch = 20;
const slippage = ethers.utils.parseEther('.1'); // 10 pct max slippage
const buyFee = ethers.utils.parseEther('0.0015'); // 0.15% Buying Trading Fee
const sellFee = ethers.utils.parseEther('0.003'); // 0.3% Buying Trading Fee
const initialCurveSupply = initialCurveLiquidity / (targetInitialPrice * reserveRatio); // Value from model 61714285.71428571 OR 77.14285714285714, now calculated dynamically
const minCurveSupply = ethers.utils.parseEther('60000000');
const PPM = 1000000;
const reserveRatioPPM = reserveRatio * PPM; // 250000 => 25 pct in PPM

// Simulation Variables
const simulationRuns = 5;
const simulationAmount = ethers.utils.parseEther('100000');

// Helpers
const openAndClaimBuyOrder = require('./helpers/utils').openAndClaimBuyOrder(this, blocksPerBatch);
const openAndClaimSellOrder = require('./helpers/utils').openAndClaimSellOrder(this, blocksPerBatch);
const progressToNextBatch = require('./helpers/utils').progressToNextBatch(blocksPerBatch);

describe("BatchedBancorMarketMaker.sol: testing the Curve!", () => {

  before(async  () => {
    const wallets = await ethers.getSigners();
    this.admin = wallets[0];
    this.minter = wallets[1];
    this.pauser = wallets[2];
    this.treasury = wallets[3];
    this.alice = wallets[4];
    this.bob = wallets[5];
    this.charlie = wallets[6];
  });
  
  describe('Setting up the environment', () => {
    it("Should deploy MSU", async () => {
      const MSUContract = await ethers.getContractFactory('MetaSoccerToken');
      this.msu = await MSUContract.connect(this.admin).deploy(this.treasury.address, initialSupply)
        .then(f => f.deployed());
      expect(await this.msu.name()).to.equal('Test Curve MSU');
      expect(await this.msu.symbol()).to.equal('TMSU');
      expect(await this.msu.decimals()).to.equal(18);
      expect(await this.msu.MINTER_ROLE())
        .to.equal('0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6');
      expect(await this.msu.PAUSER_ROLE())
        .to.equal('0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a');
  	  expect(await this.msu.totalSupply()).to.equal(initialSupply);
    })

    it("Should deploy Test DAI", async () => {
      const DAIContract = await ethers.getContractFactory('TestDAI');
      this.dai = await DAIContract.connect(this.admin).deploy(this.treasury.address, ethers.utils.parseEther('1000000000'))
        .then(f => f.deployed());
      expect(await this.dai.name()).to.equal('Test Curve DAI');
      expect(await this.dai.symbol()).to.equal('TCDAI');
      expect(await this.dai.decimals()).to.equal(18);
    })

    it("Should deploy Bancor Formula", async () => {
      const Formula = await ethers.getContractFactory('BancorFormula');
      this.formula = await Formula.connect(this.admin).deploy()
        .then(f => f.deployed());
  	  expect(await this.formula.version()).to.equal(4);
    })


    it("Should fail to deploy the Curve with wrong arguments", async () => {
      const Curve = await ethers.getContractFactory('BatchedBancorMarketMaker');
      await expect(Curve.connect(this.admin).deploy(this.formula.address, this.msu.address, "0x0000000000000000000000000000000000000000", ethers.utils.parseEther(initialCurveSupply.toString()), minCurveSupply, blocksPerBatch, buyFee, sellFee)).to.be.revertedWith("MM_INVALID_BENEFICIARY");
      await expect(Curve.connect(this.admin).deploy(this.formula.address, this.msu.address, this.admin.address, ethers.utils.parseEther(initialCurveSupply.toString()), minCurveSupply, 0, buyFee, sellFee)).to.be.revertedWith("MM_INVALID_BATCH_BLOCKS");
      await expect(Curve.connect(this.admin).deploy(this.formula.address, this.msu.address, this.admin.address, ethers.utils.parseEther(initialCurveSupply.toString()), minCurveSupply, blocksPerBatch, buyFee, ethers.utils.parseEther('1'))).to.be.revertedWith("MM_INVALID_PERCENTAGE");
    })

    it("Should deploy the Curve", async () => {
      const Curve = await ethers.getContractFactory('BatchedBancorMarketMaker');
      this.curve = await Curve.connect(this.admin).deploy(this.formula.address, this.msu.address, this.admin.address, ethers.utils.parseEther(initialCurveSupply.toString()), minCurveSupply, blocksPerBatch, buyFee, sellFee)
        .then(f => f.deployed());
      expect(await this.curve.beneficiary()).to.equal(this.admin.address);
    })

    it("Should set the Curve as a valid minter", async () => {
      const MINTER_ROLE = await this.msu.MINTER_ROLE();
      await this.msu.connect(this.admin).grantRole(MINTER_ROLE, this.curve.address);
      expect(await this.msu.hasRole(MINTER_ROLE, this.curve.address)).to.equal(true);
    })
    
  });

  describe('Initializing the Curve', () => {

    // it("Should set a valid address to add new collateral", async () => {
    //   const ADD_ROLE = await this.curve.ADD_COLLATERAL_TOKEN_ROLE();
    //   const tx = await this.curve.connect(this.admin)
    //     .grantRole(ADD_ROLE, this.treasury.address);
    //   await tx.wait();
    // })

    it("Should set a valid address to open trading", async () => {
      const OPEN_ROLE = await this.curve.OPEN_ROLE();
      await this.curve.connect(this.admin).grantRole(OPEN_ROLE, this.admin.address);
      expect(await this.curve.hasRole(OPEN_ROLE, this.admin.address)).to.equal(true);
    })

    it("Should add initial collateral to the curve", async () => {
      await this.dai.connect(this.treasury).transfer(this.curve.address, ethers.utils.parseEther(initialCurveLiquidity.toString()));
      await this.curve.connect(this.admin).addCollateralToken(this.dai.address, ethers.BigNumber.from(0), ethers.BigNumber.from(0), reserveRatioPPM, slippage);
    
      expect(await this.dai.balanceOf(this.curve.address)).to.equal(ethers.utils.parseEther(initialCurveLiquidity.toString()));
      expect(await this.curve.getCollateralToken(this.dai.address)).to.deep.equal([true, ethers.BigNumber.from(0), ethers.BigNumber.from(0), reserveRatioPPM, slippage]);

      // const pricePPM = await this.curve.getStaticPricePPM(initialCurveSupply, initialCurveLiquidity, reserveRatioPPM);
      // const price = pricePPM.mul(1000000);
      // const formatted_price = ethers.utils.formatEther(price);
      // console.log(formatted_price);

      // rounding issue so price is not exactly equal
      // expect(price).to.equal('34999999999000000');
    })

    it("Should open trading", async () => {
      await this.curve.connect(this.admin).open(true);
      expect(await this.curve.isOpen()).to.equal(true);
    })
  
  });
    
  describe('Alice buying at the Curve for 100k', () => {

    it("Should transfer 100K test DAIs to Alice", async () => {
	    const amount = ethers.utils.parseEther('100000');
      await this.dai.connect(this.treasury).transfer(this.alice.address, amount);
      expect(await this.dai.balanceOf(this.alice.address)).to.equal(amount);
    })

    // it("Should grant Alice permission to buy", async () => {
    //   const BUY_ROLE = await this.curve.OPEN_BUY_ORDER_ROLE();
    //   const tx = await this.curve.connect(this.admin)
    //     .grantRole(BUY_ROLE, this.alice.address);
    //   await tx.wait();
    // })

    it("Shouldn't allow Alice to buy with wrong collateral", async () => {
      await expect(this.curve.connect(this.alice).openBuyOrder(this.alice.address, this.msu.address, 1)).to.be.revertedWith("MM_COLLATERAL_NOT_WHITELISTED");
    })

    it("Shouldn't allow Alice to buy without approval", async () => {
      const amount = await this.dai.balanceOf(this.alice.address);
      await expect(this.curve.connect(this.alice).openBuyOrder(this.alice.address, this.dai.address, amount)).to.be.revertedWith("MM_INVALID_COLLATERAL_VALUE");
    })

    it("Shouldn't allow Alice to buy for 0", async () => {
      await expect(this.curve.connect(this.alice).openBuyOrder(this.alice.address, this.dai.address, 0)).to.be.revertedWith("MM_INVALID_COLLATERAL_VALUE");
    })

    it("Shouldn't allow Alice to sell since she hasn't bought yet", async () => {
      const aliceBalance = await this.msu.balanceOf(this.alice.address);
      await expect(this.curve.connect(this.alice).openSellOrder(this.alice.address, this.dai.address, aliceBalance)).to.be.revertedWith("MM_INVALID_BOND_AMOUNT");
    })

    it("Should allow Alice to buy at the curve for 100K TDAIs", async () => {
      const amount = ethers.utils.parseEther('100000');
      await this.dai.connect(this.alice).approve(this.curve.address, amount);
      await openAndClaimBuyOrder(this.alice, this.dai.address, amount);
    })

  });

  describe('Bob buying at the Curve for 100k', () => {

    it("Should transfer 100K test DAIs to Bob", async () => {
	    const amount = ethers.utils.parseEther('100000');
      await this.dai.connect(this.treasury).transfer(this.bob.address, amount);
      expect(await this.dai.balanceOf(this.bob.address)).to.equal(amount);
    })

    // it("Should grant Bob permission to buy", async () => {
    //   const BUY_ROLE = await this.curve.OPEN_BUY_ORDER_ROLE();
    //   const tx = await this.curve.connect(this.admin)
    //     .grantRole(BUY_ROLE, this.bob.address);
    //   await tx.wait();
    // })

    it("Should allow Bob to buy at the curve for 100K TDAIs", async () => {
      const amount = ethers.utils.parseEther('100000');
      await this.dai.connect(this.bob).approve(this.curve.address, amount);
      await openAndClaimBuyOrder(this.bob, this.dai.address, amount);
    })

  });

  describe('Alice selling at the Curve', () => {

    // it("Should grant Alice permission to sell", async () => {
    //   const SELL_ROLE = await this.curve.OPEN_SELL_ORDER_ROLE();
    //   const tx = await this.curve.connect(this.admin)
    //     .grantRole(SELL_ROLE, this.alice.address);
    //   await tx.wait();
    // })

    it("Shouldn't allow Alice to sell his MSUs without approval", async () => {
      const aliceBalance = await this.msu.balanceOf(this.alice.address);
      await expect(this.curve.connect(this.alice).openSellOrder(this.alice.address, this.dai.address, aliceBalance)).to.be.revertedWith("ERC20: burn amount exceeds allowance");
    })

    it("Should allow Alice to sell at the curve all his MSUs", async () => {
      const aliceBalance = await this.msu.balanceOf(this.alice.address);
      await this.msu.connect(this.alice).approve(this.curve.address, aliceBalance);
      await openAndClaimSellOrder(this.alice, this.dai.address, aliceBalance);
    })

  });

  describe('Bob selling at the Curve', () => {

    // it("Should grant Bob permission to sell", async () => {
    //   const SELL_ROLE = await this.curve.OPEN_SELL_ORDER_ROLE();
    //   const tx = await this.curve.connect(this.admin)
    //     .grantRole(SELL_ROLE, this.bob.address);
    //   await tx.wait();
    // })

    it("Should allow Bob to sell at the curve all his MSUs", async () => {
      const bobBalance = await this.msu.balanceOf(this.bob.address);
      await this.msu.connect(this.bob).approve(this.curve.address, bobBalance);
      await openAndClaimSellOrder(this.bob, this.dai.address, bobBalance);
    })

  });

  describe('Alice and Bob buying in same batch', () => {
    
    it("Should allow Alice and Bob to buy in same batch", async () => {
      const amountA = ethers.utils.parseEther('50000');
      const amountB = ethers.utils.parseEther('50000');
      await this.dai.connect(this.alice).approve(this.curve.address, amountA);
      await this.dai.connect(this.bob).approve(this.curve.address, amountB);
      // await bulkOpenAndClaimBuyOrder(this.dai.address, [{from: this.alice, amount: amount}, {from: this.bob, amount: amount}]);
      const txA = await this.curve.connect(this.alice).openBuyOrder(this.alice.address, this.dai.address, amountA);
      const receiptA = await txA.wait();
      const eventA = receiptA.events?.filter((x) => {return x.event == "OpenBuyOrder"});
      const batchIdA = eventA['0']['args']['batchId'];
      const txB = await this.curve.connect(this.bob).openBuyOrder(this.bob.address, this.dai.address, amountB);
      const receiptB = await txB.wait();
      const eventB = receiptB.events?.filter((x) => {return x.event == "OpenBuyOrder"});
      const batchIdB = eventB['0']['args']['batchId'];
      expect(batchIdA).to.equal(batchIdB);

      await progressToNextBatch();
  
      await this.curve.connect(this.alice).claimBuyOrder(this.alice.address, batchIdA, this.dai.address);
      await this.curve.connect(this.bob).claimBuyOrder(this.bob.address, batchIdB, this.dai.address);
    })
    
    it("Should allow Bob to sell at the curve all his MSUs", async () => {
      const bobBalance = await this.msu.balanceOf(this.bob.address);
      await this.msu.connect(this.bob).approve(this.curve.address, bobBalance);
      await openAndClaimSellOrder(this.bob, this.dai.address, bobBalance);
    })

    it("Should allow Alice to sell at the curve all his MSUs", async () => {
      const aliceBalance = await this.msu.balanceOf(this.alice.address);
      await this.msu.connect(this.alice).approve(this.curve.address, aliceBalance);
      await openAndClaimSellOrder(this.alice, this.dai.address, aliceBalance);
    })

  });

  describe('Alice and Bob trying to buy in same batch but Bob getting slippage and having to wait', () => {

    it("Should allow Alice to buy but not Bob in same batch since slippage is exceeded", async () => {
      const amountA = ethers.utils.parseEther('100000');
      const amountB = ethers.utils.parseEther('50000');
      await this.dai.connect(this.alice).approve(this.curve.address, amountA);
      await this.dai.connect(this.bob).approve(this.curve.address, amountB);
      // await bulkOpenAndClaimBuyOrder(this.dai.address, [{from: this.alice, amount: amount}, {from: this.bob, amount: amount}]);
      const txA = await this.curve.connect(this.alice).openBuyOrder(this.alice.address, this.dai.address, amountA);
      const receiptA = await txA.wait();
      const eventA = receiptA.events?.filter((x) => {return x.event == "OpenBuyOrder"});
      const batchIdA = eventA['0']['args']['batchId'];
      await expect(this.curve.connect(this.bob).openBuyOrder(this.bob.address, this.dai.address, amountB)).to.be.revertedWith("MM_SLIPPAGE_EXCEEDS_LIMIT");
      
      await progressToNextBatch();
  
      await this.curve.connect(this.alice).claimBuyOrder(this.alice.address, batchIdA, this.dai.address);

      // Since we reached next Batch, bob should be able to buy
      await openAndClaimBuyOrder(this.bob, this.dai.address, amountB);
    })

    it("Should allow Alice to sell at the curve all his MSUs", async () => {
      const aliceBalance = await this.msu.balanceOf(this.alice.address);
      await this.msu.connect(this.alice).approve(this.curve.address, aliceBalance);
      await openAndClaimSellOrder(this.alice, this.dai.address, aliceBalance);
    })

    it("Should allow Bob to sell at the curve all his MSUs", async () => {
      const bobBalance = await this.msu.balanceOf(this.bob.address);
      await this.msu.connect(this.bob).approve(this.curve.address, bobBalance);
      await openAndClaimSellOrder(this.bob, this.dai.address, bobBalance);
    })

  });

  describe('Economic Simulation: it should properly increase and decrease price as expected', () => {

    it("Should transfer 100M test DAIs to Charlie", async () => {
	    const amount = ethers.utils.parseEther('100000000');
      await this.dai.connect(this.treasury).transfer(this.charlie.address, amount);
      expect(await this.dai.balanceOf(this.charlie.address)).to.equal(amount);
    })

    // it("Should grant Charlie permission to buy", async () => {
    //   const BUY_ROLE = await this.curve.OPEN_BUY_ORDER_ROLE();
    //   const tx = await this.curve.connect(this.admin)
    //     .grantRole(BUY_ROLE, this.charlie.address);
    //   await tx.wait();
    // })
    
    // Bulk buy and sell
    for(var i = 0; i < simulationRuns; i++){
      it("Should allow Charlie to buy at the curve for the simulation amount TDAIs", async () => {
        await this.dai.connect(this.charlie).approve(this.curve.address, simulationAmount);
        await openAndClaimBuyOrder(this.charlie, this.dai.address, simulationAmount);
      })
    }
      
    // it("Should grant Charlie permission to sell", async () => {
    //   const BUY_ROLE = await this.curve.OPEN_SELL_ORDER_ROLE();
    //   const tx = await this.curve.connect(this.admin)
    //     .grantRole(BUY_ROLE, this.charlie.address);
    //   await tx.wait();
    // })
    

    it("Should allow Charlie to sell at the curve for all his balance in same steps", async () => {
      const balance = await this.msu.balanceOf(this.charlie.address);
      const sellAmount = balance.div(BigNumber.from(simulationRuns));
      await this.msu.connect(this.charlie).approve(this.curve.address, balance);
      for(var i = 0; i < simulationRuns; i++){
        await openAndClaimSellOrder(this.charlie, this.dai.address, sellAmount);
      }
    })
  
  });

  describe('Should properly revert on wrong order claims', () => {
    it("Should allow Alice to open buy at the curve for 10K TDAIs", async () => {
      const amount = ethers.utils.parseEther('10000');
      await this.dai.connect(this.alice).approve(this.curve.address, amount);
      const txA = await this.curve.connect(this.alice).openBuyOrder(this.alice.address, this.dai.address, amount);
      const receiptA = await txA.wait();
      const eventA = receiptA.events?.filter((x) => {return x.event == "OpenBuyOrder"});
      const batchIdA = eventA['0']['args']['batchId'];

      await expect(this.curve.connect(this.alice).claimBuyOrder(this.alice.address, batchIdA, this.msu.address)).to.be.revertedWith("MM_COLLATERAL_NOT_WHITELISTED");
      await expect(this.curve.connect(this.alice).claimBuyOrder(this.alice.address, batchIdA, this.dai.address)).to.be.revertedWith("MM_BATCH_NOT_OVER");
      
      await progressToNextBatch();

      await expect(this.curve.connect(this.bob).claimBuyOrder(this.bob.address, batchIdA, this.dai.address)).to.be.revertedWith("MM_NOTHING_TO_CLAIM");
      await expect(this.curve.connect(this.alice).claimCancelledBuyOrder(this.alice.address, batchIdA, this.dai.address)).to.be.revertedWith("MM_BATCH_NOT_CANCELLED");
      await this.curve.connect(this.alice).claimBuyOrder(this.alice.address, batchIdA, this.dai.address);
      expect(await this.msu.balanceOf(this.alice.address)).to.be.above(0);
    })

    it("Should allow Alice to sell at the curve all his MSUs", async () => {
      const aliceBalance = await this.msu.balanceOf(this.alice.address);
      await this.msu.connect(this.alice).approve(this.curve.address, aliceBalance);
      const txA = await this.curve.connect(this.alice).openSellOrder(this.alice.address, this.dai.address, aliceBalance);
      const receiptA = await txA.wait();
      const eventA = receiptA.events?.filter((x) => {return x.event == "OpenSellOrder"});
      const batchIdA = eventA['0']['args']['batchId'];

      await expect(this.curve.connect(this.alice).claimSellOrder(this.alice.address, batchIdA, this.msu.address)).to.be.revertedWith("MM_COLLATERAL_NOT_WHITELISTED");
      await expect(this.curve.connect(this.alice).claimSellOrder(this.alice.address, batchIdA, this.dai.address)).to.be.revertedWith("MM_BATCH_NOT_OVER");
      
      await progressToNextBatch();

      await expect(this.curve.connect(this.bob).claimSellOrder(this.bob.address, batchIdA, this.dai.address)).to.be.revertedWith("MM_NOTHING_TO_CLAIM");
      await expect(this.curve.connect(this.alice).claimCancelledSellOrder(this.alice.address, batchIdA, this.dai.address)).to.be.revertedWith("MM_BATCH_NOT_CANCELLED");
      await this.curve.connect(this.alice).claimSellOrder(this.alice.address, batchIdA, this.dai.address);
      expect(await this.msu.balanceOf(this.alice.address)).to.equal(0);
    })
  });

  describe('Should properly react to collateral removal', () => {

    const amountA = ethers.utils.parseEther('10000');

    it("Should allow Bob to buy at the curve for 10K TDAIs", async () => {
      await this.dai.connect(this.bob).approve(this.curve.address, amountA);
      await openAndClaimBuyOrder(this.bob, this.dai.address, amountA);
    })

    it("Should allow Alice to open Buy order, Bob to open Sell order in same batch", async () => {
      await this.dai.connect(this.alice).approve(this.curve.address, amountA);

      const amountB = await this.msu.balanceOf(this.bob.address);
      this.amountB = amountB;
      await this.msu.connect(this.bob).approve(this.curve.address, amountB);

      await progressToNextBatch();

      const txA = await this.curve.connect(this.alice).openBuyOrder(this.alice.address, this.dai.address, amountA);
      const receiptA = await txA.wait();
      const eventA = receiptA.events?.filter((x) => {return x.event == "OpenBuyOrder"});
      const batchIdA = eventA['0']['args']['batchId'];
      this.batchIdA = batchIdA;

      const txB = await this.curve.connect(this.bob).openSellOrder(this.bob.address, this.dai.address, amountB);
      const receiptB = await txB.wait();
      const eventB = receiptB.events?.filter((x) => {return x.event == "OpenSellOrder"});
      const batchIdB = eventB['0']['args']['batchId'];
      this.batchIdB = batchIdB;
        
      expect(batchIdA).to.equal(batchIdB);
    })

    it("Should allow admin to remove collateral", async () => {

      await this.curve.connect(this.admin).removeCollateralToken(this.dai.address);
      
      await expect(this.curve.connect(this.alice).openBuyOrder(this.alice.address, this.dai.address, 1)).to.be.revertedWith("MM_COLLATERAL_NOT_WHITELISTED");
      await expect(this.curve.connect(this.bob).openSellOrder(this.bob.address, this.dai.address, 1)).to.be.revertedWith("MM_COLLATERAL_NOT_WHITELISTED");

    })

    it("Should fail if trying to claim wrong cancelled order ", async () => {
      await expect(this.curve.connect(this.alice).claimCancelledSellOrder(this.alice.address, this.batchIdA, this.dai.address)).to.be.revertedWith("MM_NOTHING_TO_CLAIM");
      await expect(this.curve.connect(this.bob).claimCancelledBuyOrder(this.bob.address, this.batchIdB, this.dai.address)).to.be.revertedWith("MM_NOTHING_TO_CLAIM");
    })
    
    it("Should allow users to claim cancelled orders", async () => {
      const balanceA = await this.dai.balanceOf(this.alice.address);
      await this.curve.connect(this.alice).claimCancelledBuyOrder(this.alice.address, this.batchIdA, this.dai.address);
      await this.curve.connect(this.bob).claimCancelledSellOrder(this.bob.address, this.batchIdB, this.dai.address);
      const afterBalanceA = await this.dai.balanceOf(this.alice.address);
      const aliceRefund = afterBalanceA.sub(balanceA);
      const fee = amountA.mul(buyFee).div(ethers.utils.parseEther('1'));

      expect(aliceRefund).to.equal(amountA.sub(fee));
      expect(await this.msu.balanceOf(this.bob.address)).to.equal(this.amountB);
    })

    it("Should fail to readd collateral with wrong Reserve Ratio", async () => {
      await expect(this.curve.connect(this.admin).addCollateralToken(this.dai.address, ethers.BigNumber.from(0), ethers.BigNumber.from(0), 1100000, slippage)).to.be.revertedWith("MM_INVALID_RESERVE_RATIO");
    })

    it("Should allow admin to readd collateral", async () => {
      await this.curve.connect(this.admin).addCollateralToken(this.dai.address, ethers.BigNumber.from(0), ethers.BigNumber.from(0), reserveRatioPPM, slippage);
    })

    it("Should fail to buy in current cancelled batch", async () => {
      await expect(this.curve.connect(this.alice).openBuyOrder(this.alice.address, this.dai.address, 1)).to.be.revertedWith("MM_BATCH_CANCELLED");
      await expect(this.curve.connect(this.bob).openSellOrder(this.bob.address, this.dai.address, 1)).to.be.revertedWith("MM_BATCH_CANCELLED");
    })

    it("Shouldn't allow claiming orders from cancelled batches", async () => {
      await progressToNextBatch();
      await expect(this.curve.connect(this.alice).claimBuyOrder(this.alice.address, this.batchIdA, this.dai.address)).to.be.revertedWith("MM_BATCH_CANCELLED");
      await expect(this.curve.connect(this.bob).claimSellOrder(this.bob.address, this.batchIdB, this.dai.address)).to.be.revertedWith("MM_BATCH_CANCELLED");
    })

    it("Should allow Bob to sell his MSUs after admin readds collateral", async () => {
      const bobBalance = await this.msu.balanceOf(this.bob.address);
      await this.msu.connect(this.bob).approve(this.curve.address, bobBalance);
      await openAndClaimSellOrder(this.bob, this.dai.address, bobBalance);
    })
    
  });
    
  describe('Should properly allow admin to manage the curve', () => {

    it("Should allow Admin to tap the Curve", async () => {
      const amount = ethers.utils.parseEther('25000');
      const balance = await this.dai.balanceOf(this.admin.address);
      await this.curve.connect(this.admin).withdrawCollateral(this.dai.address, amount);
      const newBalance = await this.dai.balanceOf(this.admin.address);
      expect(newBalance.sub(balance)).to.equal(amount);
    })

    it("Should allow Alice to buy at a reduced price", async () => {
      const amount = ethers.utils.parseEther('100000');
      expect(await this.curve.getCollateralPricePPM(this.dai.address)).to.be.below(targetInitialPrice * PPM);
      await this.dai.connect(this.treasury).transfer(this.alice.address, amount);
      await this.dai.connect(this.alice).approve(this.curve.address, amount);
      await openAndClaimBuyOrder(this.alice, this.dai.address, amount);
    })

    it("Should allow admin to stop trading", async () => {
      await this.curve.connect(this.admin).open(false);
      expect(await this.curve.isOpen()).to.equal(false);
    })

    it("Shouldn't allow Bob to buy at the curve since trading is stopped", async () => {
      const amount = await this.dai.balanceOf(this.bob.address);;
      await expect(this.curve.connect(this.bob).openBuyOrder(this.bob.address, this.dai.address, amount)).to.be.revertedWith("MM_NOT_OPEN");
    })

    it("Shouldn't allow Alice to sell at the curve since trading is stopped", async () => {
      const amount = await this.msu.balanceOf(this.alice.address);;
      await this.msu.connect(this.alice).approve(this.curve.address, amount);
      await expect(this.curve.connect(this.alice).openSellOrder(this.alice.address, this.dai.address, amount)).to.be.revertedWith("MM_NOT_OPEN");
    })

    it("Should allow admin to reopen trading", async () => {
      await this.curve.connect(this.admin).open(true);
      expect(await this.curve.isOpen()).to.equal(true);
    })

    it("Should allow Admin to update curve supply", async () => {
      const amount = ethers.utils.parseEther('100000000');
      await this.curve.connect(this.admin).updateCurveSupply(amount);
      const curveSupply = await this.curve.curveSupply();
      expect(curveSupply).to.equal(amount);
    })

    it("Should allow Admin to update minimum curve supply", async () => {
      const amount = ethers.utils.parseEther('100000000');
      await this.curve.connect(this.admin).updateMinCurveSupply(amount);
      const minCurveSupply = await this.curve.minCurveSupply();
      expect(minCurveSupply).to.equal(amount);
    })
    
    it("Shouldn't allow Alice to buy at the curve since minimum supply is reached", async () => {
      const amount = await this.msu.balanceOf(this.alice.address);;
      await this.msu.connect(this.alice).approve(this.curve.address, amount);
      await expect(this.curve.connect(this.alice).openSellOrder(this.alice.address, this.dai.address, amount)).to.be.revertedWith("MM_INSUFFICIENT_POOL_BALANCE");
    })

    it("Should deploy updated Bancor Formula", async () => {
      const formula = await ethers.getContractFactory('BancorFormula');
      this.formula2 = await formula.connect(this.admin).deploy()
        .then(f => f.deployed());
  	  expect(await this.formula2.version()).to.equal(4);
    })

    it("Should allow Admin to update bancor formula", async () => {
      await this.curve.connect(this.admin).updateFormula(this.formula2.address);
      expect(await this.curve.formula()).to.equal(this.formula2.address);
    })

    it("Should allow Admin to update trading fees", async () => {
      await this.curve.connect(this.admin).updateFees(0, 0);
      expect(await this.curve.buyFeePct()).to.equal(0);
      expect(await this.curve.sellFeePct()).to.equal(0);
    })

    it("Should fail if Admin tries to update with invalid Fees", async () => {
      await expect(this.curve.connect(this.admin).updateFees(0, ethers.utils.parseEther('1'))).to.be.revertedWith("MM_INVALID_PERCENTAGE");
    })

    it("Should allow Admin to update beneficiary", async () => {
      await this.curve.connect(this.admin).updateBeneficiary(this.treasury.address);
      expect(await this.curve.beneficiary()).to.equal(this.treasury.address);
    })

    it("Should fail if Admin tries to update an invalid beneficiary", async () => {
      await expect(this.curve.connect(this.admin).updateBeneficiary("0x0000000000000000000000000000000000000000")).to.be.revertedWith("MM_INVALID_BENEFICIARY");
    })

    it("Should fail if Admin tries to update an invalid collateral", async () => {
      await expect(this.curve.connect(this.admin).updateCollateralToken(this.msu.address, ethers.BigNumber.from(0), ethers.BigNumber.from(0), reserveRatioPPM, slippage)).to.be.revertedWith("MM_COLLATERAL_NOT_WHITELISTED");
      await expect(this.curve.connect(this.admin).updateCollateralToken(this.dai.address, ethers.BigNumber.from(0), ethers.BigNumber.from(0), 1100000, slippage)).to.be.revertedWith("MM_INVALID_RESERVE_RATIO");
    })

    it("Should allow Admin to update collateral Token Reserve Ratio", async () => {
      const newRRPPM = 300000
      await this.curve.connect(this.admin).updateCollateralToken(this.dai.address, ethers.BigNumber.from(0), ethers.BigNumber.from(0), newRRPPM, slippage);
      const collateral = await this.curve.collaterals(this.dai.address);
      expect(collateral.reserveRatio).to.equal(newRRPPM);
    })

    it("Should fail to add managed token as collateral", async () => {
      await expect(this.curve.connect(this.admin).addCollateralToken(this.msu.address, ethers.BigNumber.from(0), ethers.BigNumber.from(0), reserveRatioPPM, slippage)).to.be.revertedWith("MM_INVALID_COLLATERAL");
    })

    it("Should fail to readd dai token as collateral", async () => {
      await expect(this.curve.connect(this.admin).addCollateralToken(this.dai.address, ethers.BigNumber.from(0), ethers.BigNumber.from(0), reserveRatioPPM, slippage)).to.be.revertedWith("MM_COLLATERAL_ALREADY_WHITELISTED");
    })

    it("Should fail to remove non whitelisted dai token as collateral", async () => {
      await expect(this.curve.connect(this.admin).removeCollateralToken(this.msu.address)).to.be.revertedWith("MM_COLLATERAL_NOT_WHITELISTED");
    })

    it("Should return current batch", async () => {
      const batchId = await this.curve.getCurrentBatchId();
      const batch = await this.curve.getBatch(batchId, this.dai.address);
    })

  });

});
