# MetaSoccer Token Bonding Curve


## User-level interactions
The Curve Smart Contract allows users to buy / sell MSU. Orders are aggregated by batches to avoid front-running, each batch takes a predefined number of blocks that the user needs to wait in order to claim the order. User interaction is done via the following methods:

**1. Open Buy Order**
Allows the user to open a buy order for a given amount of collateral (for example buy MSUs for 1000 DAIs). He transfers the DAIs but needs to wait the end of the batch to get the resulting MSUs.


      /**
      * @notice Open a buy order worth @tokenAmount(_collateral, _value)
      * @param _buyer      The address of the buyer
      * @param _collateral The address of the collateral token to be spent
      * @param _value      The amount of collateral token to be spent
      */
      function openBuyOrder(address _buyer, address _collateral, uint256 _value) external onlyRole(OPEN_BUY_ORDER_ROLE) {
          require(isOpen,                                                          ERROR_NOT_OPEN);
          require(_collateralIsWhitelisted(_collateral),                           ERROR_COLLATERAL_NOT_WHITELISTED);
          require(!_batchIsCancelled(_currentBatchId(), _collateral),              ERROR_BATCH_CANCELLED);
          require(_collateralValueIsValid(_buyer, _collateral, _value), ERROR_INVALID_COLLATERAL_VALUE);

          _openBuyOrder(_buyer, _collateral, _value);
      }

**2. Open Sell Order**
Allows the user to open a sell order for a given amount of MSUs (for example sell 1000 MSUs for DAIs). He transfers the MSUs but needs to wait the end of the batch to get the resulting DAIs.

    /**
     * @notice Open a sell order worth `@tokenAmount(self.token(): address, _amount)` against `_collateral.symbol(): string`
     * @param _seller     The address of the seller
     * @param _collateral The address of the collateral token to be returned
     * @param _amount     The amount of bonded token to be spent
    */
    function openSellOrder(address _seller, address _collateral, uint256 _amount) external onlyRole(OPEN_SELL_ORDER_ROLE) {
        require(isOpen,                                             ERROR_NOT_OPEN);
        require(_collateralIsWhitelisted(_collateral),              ERROR_COLLATERAL_NOT_WHITELISTED);
        require(!_batchIsCancelled(_currentBatchId(), _collateral), ERROR_BATCH_CANCELLED);
        require(_bondAmountIsValid(_seller, _amount),               ERROR_INVALID_BOND_AMOUNT);
        require(curveSupply.sub(_amount) > minCurveSupply,          ERROR_INSUFFICIENT_POOL_BALANCE);

        _openSellOrder(_seller, _collateral, _amount);
    }

**3. Claim Buy Order**
Allows the user to get his MSUs after opening a buy order when the batch is done.
    
    /**
     * @notice Claim the results of `_buyer`'s `_collateral.symbol(): string` buy orders from batch #`_batchId`
     * @param _buyer      The address of the user whose buy orders are to be claimed
     * @param _batchId    The id of the batch in which buy orders are to be claimed
     * @param _collateral The address of the collateral token against which buy orders are to be claimed
    */
    function claimBuyOrder(address _buyer, uint256 _batchId, address _collateral) external nonReentrant {
        require(_collateralIsWhitelisted(_collateral),       ERROR_COLLATERAL_NOT_WHITELISTED);
        require(_batchIsOver(_batchId),                      ERROR_BATCH_NOT_OVER);
        require(!_batchIsCancelled(_batchId, _collateral),   ERROR_BATCH_CANCELLED);
        require(_userIsBuyer(_batchId, _collateral, _buyer), ERROR_NOTHING_TO_CLAIM);

        _claimBuyOrder(_buyer, _batchId, _collateral);
    }

**4. Claim Sell Order**
Allows the user to get his DAIs after opening a sell order when the batch is done.

    /**
     * @notice Claim the results of `_seller`'s `_collateral.symbol(): string` sell orders from batch #`_batchId`
     * @param _seller     The address of the user whose sell orders are to be claimed
     * @param _batchId    The id of the batch in which sell orders are to be claimed
     * @param _collateral The address of the collateral token against which sell orders are to be claimed
    */
    function claimSellOrder(address _seller, uint256 _batchId, address _collateral) external nonReentrant {
        require(_collateralIsWhitelisted(_collateral),         ERROR_COLLATERAL_NOT_WHITELISTED);
        require(_batchIsOver(_batchId),                        ERROR_BATCH_NOT_OVER);
        require(!_batchIsCancelled(_batchId, _collateral),     ERROR_BATCH_CANCELLED);
        require(_userIsSeller(_batchId, _collateral, _seller), ERROR_NOTHING_TO_CLAIM);

        _claimSellOrder(_seller, _batchId, _collateral);
    }

**5. Claim Cancelled Buy Order**
In rare cases (when collateral is removed) it may happen that a given batch is cancelled and pending orders may still be open. This method allows an user who bought to get back the collateral he paid (DAIs).

    /**
     * @notice Claim the investments of `_buyer`'s `_collateral.symbol(): string` buy orders from cancelled batch #`_batchId`
     * @param _buyer      The address of the user whose cancelled buy orders are to be claimed
     * @param _batchId    The id of the batch in which cancelled buy orders are to be claimed
     * @param _collateral The address of the collateral token against which cancelled buy orders are to be claimed
    */
    function claimCancelledBuyOrder(address _buyer, uint256 _batchId, address _collateral) external nonReentrant {
        require(_batchIsCancelled(_batchId, _collateral),    ERROR_BATCH_NOT_CANCELLED);
        require(_userIsBuyer(_batchId, _collateral, _buyer), ERROR_NOTHING_TO_CLAIM);

        _claimCancelledBuyOrder(_buyer, _batchId, _collateral);
    }

**6. Claim Cancelled Sell Order**
In rare cases (when collateral is removed) it may happen that a given batch is cancelled and pending orders may still be open. This method allows an user who sold to get back his tokens (MSUs).

    /**
     * @notice Claim the investments of `_seller`'s `_collateral.symbol(): string` sell orders from cancelled batch #`_batchId`
     * @param _seller     The address of the user whose cancelled sell orders are to be claimed
     * @param _batchId    The id of the batch in which cancelled sell orders are to be claimed
     * @param _collateral The address of the collateral token against which cancelled sell orders are to be claimed
    */
    function claimCancelledSellOrder(address _seller, uint256 _batchId, address _collateral) external nonReentrant {
        require(_batchIsCancelled(_batchId, _collateral),      ERROR_BATCH_NOT_CANCELLED);
        require(_userIsSeller(_batchId, _collateral, _seller), ERROR_NOTHING_TO_CLAIM);

        _claimCancelledSellOrder(_seller, _batchId, _collateral);
    }

