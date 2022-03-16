const openAndClaimBuyOrder = (test, blocksPerBatch) => async (from, collateral, amount) => {
  const beforePricePPM = await test.curve.getCollateralPricePPM(collateral);
  const beforePrice = beforePricePPM.toNumber() / 1000000
  const tx = await test.curve.connect(from).openBuyOrder(from.address, collateral, amount);
  const receipt = await tx.wait();
  const event = receipt.events?.filter((x) => {return x.event == "OpenBuyOrder"});
  const batchId = event['0']['args']['batchId'];
    
  await progressToNextBatch(blocksPerBatch)();
  
  const initialMsuBalance = await test.msu.balanceOf(from.address);
  await test.curve.connect(from).claimBuyOrder(from.address, batchId, collateral);
  const finalMsuBalance = await test.msu.balanceOf(from.address);
  const tradeMsuAmount = finalMsuBalance.sub(initialMsuBalance);
  const avgPrice = Number(ethers.utils.formatEther(amount)) / Number(ethers.utils.formatEther(tradeMsuAmount));
  const slippage = (avgPrice - beforePrice)/beforePrice;
  const totalSupply = await test.msu.totalSupply();
  const totalReserve = await test.dai.balanceOf(test.curve.address);
  const totalFees = await test.dai.balanceOf(test.admin.address);
  const afterPricePPM = await test.curve.getCollateralPricePPM(collateral);
  const afterPrice = (afterPricePPM.toNumber()/1000000);
  const priceDelta = (afterPrice - beforePrice)/beforePrice;
  /*
  console.log("\nSuccesful curve BUY! \nBefore Price: %s DAI/MSU \nFrom: %s \nDAI Amount: %s \nMSU Amount: %s \nAverage trade price: %s DAI/MSU\nTrade Slippage: %s\% \nAfter Price: %s DAI/MSU \nPrice Delta: %s\% \nTotal MSU Supply: %s \nTotal Curve Reserve: %s\nAccumulated Trading Fees: %s DAI",
    beforePrice,
    from.address,
    ethers.utils.formatEther(amount),
    ethers.utils.formatEther(tradeMsuAmount),
    avgPrice,
    (slippage*100).toFixed(4),
    afterPrice,
    (priceDelta*100).toFixed(4),
    ethers.utils.formatEther(totalSupply),
    ethers.utils.formatEther(totalReserve),
    ethers.utils.formatEther(totalFees)
    );
    */
}

const openAndClaimSellOrder = (test, blocksPerBatch) => async (from, collateral, amount) => {
  const beforePricePPM = await test.curve.getCollateralPricePPM(collateral);
  const beforePrice = beforePricePPM.toNumber() / 1000000;
  const tx = await test.curve.connect(from).openSellOrder(from.address, collateral, amount);
  const receipt = await tx.wait();
  const event = receipt.events?.filter((x) => {return x.event == "OpenSellOrder"});
  const batchId = event['0']['args']['batchId'];
    
  await progressToNextBatch(blocksPerBatch)();
  
  const initialBalance = await test.dai.balanceOf(from.address);
  await test.curve.connect(from).claimSellOrder(from.address, batchId, collateral);
  const finalBalance = await test.dai.balanceOf(from.address);
  const tradeAmount = finalBalance.sub(initialBalance);
  const avgPrice = Number(ethers.utils.formatEther(tradeAmount)) / Number(ethers.utils.formatEther(amount));
  const slippage = (avgPrice - beforePrice)/beforePrice;
  const totalSupply = await test.msu.totalSupply();
  const totalReserve = await test.dai.balanceOf(test.curve.address);
  const totalFees = await test.dai.balanceOf(test.admin.address);
  const afterPricePPM = await test.curve.getCollateralPricePPM(collateral);
  const afterPrice = (afterPricePPM.toNumber()/1000000);
  const priceDelta = (afterPrice - beforePrice)/beforePrice;
  /*
  console.log("\nSuccesful curve SELL! \nBefore Price: %s DAI/MSU \nFrom: %s \nDAI Amount: %s \nMSU Amount: %s \nAverage trade price: %s DAI/MSU\nTrade Slippage: %s\% \nAfter Price: %s DAI/MSU \nPrice Delta: %s\% \nTotal MSU Supply: %s \nTotal Curve Reserve: %s\nAccumulated Trading Fees: %s DAI",
    beforePrice,
    from.address,
    ethers.utils.formatEther(tradeAmount),
    ethers.utils.formatEther(amount),
    avgPrice,
    (slippage*100).toFixed(4),
    afterPrice,
    (priceDelta*100).toFixed(4),
    ethers.utils.formatEther(totalSupply),
    ethers.utils.formatEther(totalReserve),
    ethers.utils.formatEther(totalFees)
    );
    */
}

const bulkOpenAndClaimBuyOrder = (test, blocksPerBatch) => async (collateral, froms_with_amounts) => {
  const beforePricePPM = await test.curve.getCollateralPricePPM(collateral);
  const beforePrice = beforePricePPM.toNumber() / 1000000;
  let batchIds = [];

  froms_with_amounts.forEach(async (from_with_amount) => {
    const from = from_with_amount.from;
    console.log(from);
    const tx = await test.curve.connect(from).openBuyOrder(from.address, collateral, from_with_amount.amount);
    const receipt = await tx.wait();
    const event = receipt.events?.filter((x) => {return x.event == "OpenBuyOrder"});
    const batchId = event['0']['args']['batchId'];
    console.log(batchId);
    batchIds.push(batchId);
  });
  console.log(batchIds);
    
  await progressToNextBatch(blocksPerBatch)();
  
  for (from_with_amount in froms_with_amounts){
    await test.curve.connect(from_with_amount.from).claimSellOrder(from_with_amount.from.address, batchIds[0], collateral);
  }

}

const progressToNextBatch = (blocksPerBatch) => async () => {
  const currentBlock = await network.provider.send("eth_blockNumber");
  const currentBatch = Math.floor(currentBlock / blocksPerBatch) * blocksPerBatch;
  const blocksUntilNextBatch = currentBatch + blocksPerBatch - currentBlock;
  for(var i = 0; i < blocksUntilNextBatch; i++){
    await network.provider.send("evm_mine");
  }
}

module.exports = {
  openAndClaimBuyOrder: openAndClaimBuyOrder,
  openAndClaimSellOrder: openAndClaimSellOrder,
  bulkOpenAndClaimBuyOrder: bulkOpenAndClaimBuyOrder,
  progressToNextBatch: progressToNextBatch
}
