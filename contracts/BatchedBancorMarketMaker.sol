// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./bancor-formula/interfaces/IBancorFormula.sol";
import "./bancor-formula/BancorFormula.sol";
import "./ERC20Token.sol";

contract BatchedBancorMarketMaker is AccessControl, ReentrancyGuard {
    using SafeERC20 for ERC20;
    using SafeERC20 for ERC20Token;
    using SafeMath  for uint256;

    /**
    Hardcoded constants to save gas
    bytes32 public constant OPEN_ROLE                    = keccak256("OPEN_ROLE");
    */
    bytes32 public constant OPEN_ROLE                    = 0xefa06053e2ca99a43c97c4a4f3d8a394ee3323a8ff237e625fba09fe30ceb0a4;
    
    uint256 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10 ** 16; 100% = 10 ** 18
    uint32  public constant PPM      = 1000000;

    string private constant ERROR_CONTRACT_IS_EOA                = "MM_CONTRACT_IS_EOA";
    string private constant ERROR_INVALID_BENEFICIARY            = "MM_INVALID_BENEFICIARY";
    string private constant ERROR_INVALID_BATCH_BLOCKS           = "MM_INVALID_BATCH_BLOCKS";
    string private constant ERROR_INVALID_PERCENTAGE             = "MM_INVALID_PERCENTAGE";
    string private constant ERROR_INVALID_RESERVE_RATIO          = "MM_INVALID_RESERVE_RATIO";
    string private constant ERROR_INVALID_TM_SETTING             = "MM_INVALID_TM_SETTING";
    string private constant ERROR_INVALID_COLLATERAL             = "MM_INVALID_COLLATERAL";
    string private constant ERROR_INVALID_COLLATERAL_VALUE       = "MM_INVALID_COLLATERAL_VALUE";
    string private constant ERROR_INVALID_BOND_AMOUNT            = "MM_INVALID_BOND_AMOUNT";
    string private constant ERROR_NOT_OPEN                       = "MM_NOT_OPEN";
    string private constant ERROR_COLLATERAL_ALREADY_WHITELISTED = "MM_COLLATERAL_ALREADY_WHITELISTED";
    string private constant ERROR_COLLATERAL_NOT_WHITELISTED     = "MM_COLLATERAL_NOT_WHITELISTED";
    string private constant ERROR_NOTHING_TO_CLAIM               = "MM_NOTHING_TO_CLAIM";
    string private constant ERROR_BATCH_NOT_OVER                 = "MM_BATCH_NOT_OVER";
    string private constant ERROR_BATCH_CANCELLED                = "MM_BATCH_CANCELLED";
    string private constant ERROR_BATCH_NOT_CANCELLED            = "MM_BATCH_NOT_CANCELLED";
    string private constant ERROR_SLIPPAGE_EXCEEDS_LIMIT         = "MM_SLIPPAGE_EXCEEDS_LIMIT";
    string private constant ERROR_INSUFFICIENT_POOL_BALANCE      = "MM_INSUFFICIENT_POOL_BALANCE";
    string private constant ERROR_TRANSFER_FROM_FAILED           = "MM_TRANSFER_FROM_FAILED";

    uint256 public curveSupply;
    uint256 public minCurveSupply;

    struct Collateral {
        bool    whitelisted;
        uint256 virtualSupply;
        uint256 virtualBalance;
        uint32  reserveRatio;
        uint256 slippage;
    }

    struct MetaBatch {
        bool           initialized;
        uint256        realSupply;
        uint256        buyFeePct;
        uint256        sellFeePct;
        IBancorFormula formula;
        mapping(address => Batch) batches;
    }

    struct Batch {
        bool    initialized;
        bool    cancelled;
        uint256 supply;
        uint256 balance;
        uint32  reserveRatio;
        uint256 slippage;
        uint256 totalBuySpend;
        uint256 totalBuyReturn;
        uint256 totalSellSpend;
        uint256 totalSellReturn;
        mapping(address => uint256) buyers;
        mapping(address => uint256) sellers;
    }

    ERC20Token                public token;
    address                        public beneficiary;
    IBancorFormula                 public formula;

    uint256                        public batchBlocks;
    uint256                        public buyFeePct;
    uint256                        public sellFeePct;

    bool                           public isOpen;
    uint256                        public tokensToBeMinted;
    mapping(address => uint256)    public collateralsToBeClaimed;
    mapping(address => Collateral) public collaterals;
    mapping(uint256 => MetaBatch)  public metaBatches;

    event UpdateBeneficiary      (address indexed beneficiary);
    event UpdateFormula          (address indexed formula);
    event UpdateFees             (uint256 buyFeePct, uint256 sellFeePct);
    event NewMetaBatch           (uint256 indexed id, uint256 supply, uint256 buyFeePct, uint256 sellFeePct, address formula);
    event NewBatch               (
        uint256 indexed id,
        address indexed collateral,
        uint256 supply,
        uint256 balance,
        uint32  reserveRatio,
        uint256 slippage)
    ;
    event CancelBatch            (uint256 indexed id, address indexed collateral);
    event AddCollateralToken     (
        address indexed collateral,
        uint256 virtualSupply,
        uint256 virtualBalance,
        uint32  reserveRatio,
        uint256 slippage
    );
    event RemoveCollateralToken  (address indexed collateral);
    event UpdateCollateralToken  (
        address indexed collateral,
        uint256 virtualSupply,
        uint256 virtualBalance,
        uint32  reserveRatio,
        uint256 slippage
    );
    event Open                   (bool indexed status);
    event OpenBuyOrder           (address indexed buyer, uint256 indexed batchId, address indexed collateral, uint256 fee, uint256 value);
    event OpenSellOrder          (address indexed seller, uint256 indexed batchId, address indexed collateral, uint256 amount);
    event ClaimBuyOrder          (address indexed buyer, uint256 indexed batchId, address indexed collateral, uint256 amount);
    event ClaimSellOrder         (address indexed seller, uint256 indexed batchId, address indexed collateral, uint256 fee, uint256 value);
    event ClaimCancelledBuyOrder (address indexed buyer, uint256 indexed batchId, address indexed collateral, uint256 value);
    event ClaimCancelledSellOrder(address indexed seller, uint256 indexed batchId, address indexed collateral, uint256 amount);
    event UpdatePricing          (
        uint256 indexed batchId,
        address indexed collateral,
        uint256 totalBuySpend,
        uint256 totalBuyReturn,
        uint256 totalSellSpend,
        uint256 totalSellReturn
    );

    /**
     * @notice Initialize market maker
     * @param _formula      The address of the BancorFormula [computation] contract
     * @param _token        The address of the [bonded token] token contract
     * @param _beneficiary  The address of the beneficiary [to whom fees are to be sent]
     * @param _batchBlocks  The number of blocks batches are to last
     * @param _curveSupply  The address of the beneficiary [to whom fees are to be sent]
     * @param _beneficiary  The address of the beneficiary [to whom fees are to be sent]
     * @param _buyFeePct    The fee to be deducted from buy orders [in PCT_BASE]
     * @param _sellFeePct   The fee to be deducted from sell orders [in PCT_BASE]
    */
    constructor (
        IBancorFormula               _formula,
        address                      _token,
        address                      _beneficiary,
        uint256                      _curveSupply,
        uint256                      _minCurveSupply,
        uint256                      _batchBlocks,
        uint256                      _buyFeePct,
        uint256                      _sellFeePct
    )
    {   
        require(_beneficiaryIsValid(_beneficiary),                   ERROR_INVALID_BENEFICIARY);
        require(_batchBlocks > 0,                                    ERROR_INVALID_BATCH_BLOCKS);
        require(_feeIsValid(_buyFeePct) && _feeIsValid(_sellFeePct), ERROR_INVALID_PERCENTAGE);

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        formula = _formula;
        token = ERC20Token(_token);
        beneficiary = _beneficiary;
        curveSupply = _curveSupply;
        minCurveSupply = _minCurveSupply;
        batchBlocks = _batchBlocks;
        buyFeePct = _buyFeePct;
        sellFeePct = _sellFeePct;
    }

    /***** external function *****/

    /**
     * @notice Open market making [enabling users to open buy and sell orders]
    */
    function open(bool _status) external onlyRole(OPEN_ROLE) {
        _open(_status);
    }

    /**
     * @notice Update formula to `_formula`
     * @param _formula The address of the new BancorFormula [computation] contract
    */
    function updateFormula(IBancorFormula _formula) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _updateFormula(_formula);
    }

    /**
     * @notice Update beneficiary to `_beneficiary`
     * @param _beneficiary The address of the new beneficiary [to whom fees are to be sent]
    */
    function updateBeneficiary(address _beneficiary) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_beneficiaryIsValid(_beneficiary), ERROR_INVALID_BENEFICIARY);

        _updateBeneficiary(_beneficiary);
    }

    /**
     * @notice Update fees deducted from buy and sell orders to respectively `@formatPct(_buyFeePct)`% and `@formatPct(_sellFeePct)`%
     * @param _buyFeePct  The new fee to be deducted from buy orders [in PCT_BASE]
     * @param _sellFeePct The new fee to be deducted from sell orders [in PCT_BASE]
    */
    function updateFees(uint256 _buyFeePct, uint256 _sellFeePct) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeIsValid(_buyFeePct) && _feeIsValid(_sellFeePct), ERROR_INVALID_PERCENTAGE);

        _updateFees(_buyFeePct, _sellFeePct);
    }

    /* collateral tokens related functions */

    /**
     * @notice Add `_collateral.symbol(): string` as a whitelisted collateral token
     * @param _collateral     The address of the collateral token to be whitelisted
     * @param _virtualSupply  The virtual supply to be used for that collateral token [in wei]
     * @param _virtualBalance The virtual balance to be used for that collateral token [in wei]
     * @param _reserveRatio   The reserve ratio to be used for that collateral token [in PPM]
     * @param _slippage       The price slippage below which each batch is to be kept for that collateral token [in PCT_BASE]
    */
    function addCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_collateral != address(token), ERROR_INVALID_COLLATERAL);
        require(!_collateralIsWhitelisted(_collateral),        ERROR_COLLATERAL_ALREADY_WHITELISTED);
        require(_reserveRatioIsValid(_reserveRatio),           ERROR_INVALID_RESERVE_RATIO);

        _addCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    /**
      * @notice Remove `_collateral.symbol(): string` as a whitelisted collateral token
      * @param _collateral The address of the collateral token to be un-whitelisted
    */
    function removeCollateralToken(address _collateral) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_collateralIsWhitelisted(_collateral), ERROR_COLLATERAL_NOT_WHITELISTED);

        _removeCollateralToken(_collateral);
    }

    /**
     * @notice Update `_collateral.symbol(): string` collateralization settings
     * @param _collateral     The address of the collateral token whose collateralization settings are to be updated
     * @param _virtualSupply  The new virtual supply to be used for that collateral token [in wei]
     * @param _virtualBalance The new virtual balance to be used for that collateral token [in wei]
     * @param _reserveRatio   The new reserve ratio to be used for that collateral token [in PPM]
     * @param _slippage       The new price slippage below which each batch is to be kept for that collateral token [in PCT_BASE]
    */
    function updateCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_collateralIsWhitelisted(_collateral), ERROR_COLLATERAL_NOT_WHITELISTED);
        require(_reserveRatioIsValid(_reserveRatio),   ERROR_INVALID_RESERVE_RATIO);

        _updateCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    /* market making related functions */

    /**
     * @notice Open a buy order worth `@tokenAmount(_collateral, _value)`
     * @param _buyer      The address of the buyer
     * @param _collateral The address of the collateral token to be spent
     * @param _value      The amount of collateral token to be spent
    */
    function openBuyOrder(address _buyer, address _collateral, uint256 _value) external nonReentrant {
        require(isOpen,                                                          ERROR_NOT_OPEN);
        require(_collateralIsWhitelisted(_collateral),                           ERROR_COLLATERAL_NOT_WHITELISTED);
        require(!_batchIsCancelled(_currentBatchId(), _collateral),              ERROR_BATCH_CANCELLED);
        require(_collateralValueIsValid(_buyer, _collateral, _value), ERROR_INVALID_COLLATERAL_VALUE);

        _openBuyOrder(_buyer, _collateral, _value);
    }

    /**
     * @notice Open a sell order worth `@tokenAmount(self.token(): address, _amount)` against `_collateral.symbol(): string`
     * @param _seller     The address of the seller
     * @param _collateral The address of the collateral token to be returned
     * @param _amount     The amount of bonded token to be spent
    */
    function openSellOrder(address _seller, address _collateral, uint256 _amount) external nonReentrant {
        require(isOpen,                                             ERROR_NOT_OPEN);
        require(_collateralIsWhitelisted(_collateral),              ERROR_COLLATERAL_NOT_WHITELISTED);
        require(!_batchIsCancelled(_currentBatchId(), _collateral), ERROR_BATCH_CANCELLED);
        require(_bondAmountIsValid(_seller, _amount),               ERROR_INVALID_BOND_AMOUNT);
        require(curveSupply.sub(_amount) > minCurveSupply,          ERROR_INSUFFICIENT_POOL_BALANCE);
            
        _openSellOrder(_seller, _collateral, _amount);
    }

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

    /***** external view functions *****/

    function getCurrentBatchId() external view returns (uint256) {
        return _currentBatchId();
    }

    function getCollateralToken(address _collateral) external view returns (bool, uint256, uint256, uint32, uint256) {
        Collateral storage collateral = collaterals[_collateral];

        return (collateral.whitelisted, collateral.virtualSupply, collateral.virtualBalance, collateral.reserveRatio, collateral.slippage);
    }

    function getBatch(uint256 _batchId, address _collateral)
        external view
        returns (bool, bool, uint256, uint256, uint32, uint256, uint256, uint256, uint256, uint256)
    {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];

        return (
            batch.initialized,
            batch.cancelled,
            batch.supply,
            batch.balance,
            batch.reserveRatio,
            batch.slippage,
            batch.totalBuySpend,
            batch.totalBuyReturn,
            batch.totalSellSpend,
            batch.totalSellReturn
        );
    }

    function getCollateralPricePPM(address _collateral) external view returns (uint256) {
        return getStaticPricePPM(curveSupply.add(tokensToBeMinted), ERC20(_collateral).balanceOf(address(this)).sub(collateralsToBeClaimed[_collateral]), collaterals[_collateral].reserveRatio);
    }

    function getStaticPricePPM(uint256 _supply, uint256 _balance, uint32 _reserveRatio) public pure returns (uint256) {
        return _staticPricePPM(_supply, _balance, _reserveRatio);
    }
    
    /* admin functions */
    // Method used for tappering and emergency withdrawals
    function withdrawCollateral(address _collateral, uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ERC20(_collateral).safeTransfer(this.beneficiary(), _amount);
    }

    // Emergency method to withdraw NFT in case someone sends..
    function withdrawNFT(address _token, uint256 _tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ERC721(_token).safeTransferFrom(address(this), this.beneficiary(), _tokenId);
    }

    // Emergency method to update curve supply in case of need
    function updateCurveSupply(uint256 _supply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        curveSupply = _supply;
    }

    function updateMinCurveSupply(uint256 _minSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minCurveSupply = _minSupply;
    }


    /***** internal functions *****/

    /* computation functions */

    function _staticPricePPM(uint256 _supply, uint256 _balance, uint32 _reserveRatio) internal pure returns (uint256) {
        return uint256(PPM).mul(uint256(PPM)).mul(_balance).div(_supply.mul(uint256(_reserveRatio)));
    }

    function _currentBatchId() internal view returns (uint256) {
        return (block.number.div(batchBlocks)).mul(batchBlocks);
    }

    /* check functions */

    function _beneficiaryIsValid(address _beneficiary) internal pure returns (bool) {
        return _beneficiary != address(0);
    }

    function _feeIsValid(uint256 _fee) internal pure returns (bool) {
        return _fee < PCT_BASE;
    }

    function _reserveRatioIsValid(uint32 _reserveRatio) internal pure returns (bool) {
        return _reserveRatio <= PPM;
    }

    function _collateralValueIsValid(address _buyer, address _collateral, uint256 _value) internal view returns (bool) {
        if (_value == 0) {
            return false;
        }

        return (
            ERC20(_collateral).balanceOf(_buyer) >= _value &&
            ERC20(_collateral).allowance(_buyer, address(this)) >= _value
        );
    }

    function _bondAmountIsValid(address _seller, uint256 _amount) internal view returns (bool) {
        return _amount != 0 && token.balanceOf(_seller) >= _amount;
    }

    function _collateralIsWhitelisted(address _collateral) internal view returns (bool) {
        return collaterals[_collateral].whitelisted;
    }

    function _batchIsOver(uint256 _batchId) internal view returns (bool) {
        return _batchId < _currentBatchId();
    }

    function _batchIsCancelled(uint256 _batchId, address _collateral) internal view returns (bool) {
        return metaBatches[_batchId].batches[_collateral].cancelled;
    }

    function _userIsBuyer(uint256 _batchId, address _collateral, address _user) internal view returns (bool) {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];
        return batch.buyers[_user] > 0;
    }

    function _userIsSeller(uint256 _batchId, address _collateral, address _user) internal view returns (bool) {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];
        return batch.sellers[_user] > 0;
    }

    function _poolBalanceIsSufficient(address _collateral) internal view returns (bool) {
        return ERC20(_collateral).balanceOf(address(this)) >= collateralsToBeClaimed[_collateral];
    }

    function _slippageIsValid(Batch storage _batch) internal view returns (bool) {
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
        if (
            _batch.totalBuyReturn.mul(_startingPricePPM).mul(PCT_BASE.add(_maximumSlippage)) >=
            _batch.totalBuySpend.mul(PCT_BASE).mul(uint256(PPM))
        ) {
            return true;
        }

        return false;
    }

    function _sellSlippageIsValid(Batch storage _batch, uint256 _startingPricePPM, uint256 _maximumSlippage) internal view returns (bool) {
        /**
         * NOTE
         * the case where starting price is zero is handled
         * in the meta function _slippageIsValid()
        */

        // if allowed sell slippage >= 100%
        // then any sell slippage is valid
        if (_maximumSlippage >= PCT_BASE) {
            return true;
        }

        /**
         * NOTE
         * slippage is valid if
         * totalSellReturn >= startingPrice * (1 - maxSlippage) * totalBuySpend
         * totalSellReturn >= (startingPricePPM / PPM) * (1 - maximumSlippage / PCT_BASE) * totalBuySpend
         * totalSellReturn >= (startingPricePPM / PPM) * (PCT_BASE - maximumSlippage) * totalBuySpend / PCT_BASE
         * totalSellReturn * PCT_BASE * PPM = startingPricePPM * (PCT_BASE - maximumSlippage) * totalBuySpend
        */

        if (
            _batch.totalSellReturn.mul(PCT_BASE).mul(uint256(PPM)) >=
            _startingPricePPM.mul(PCT_BASE.sub(_maximumSlippage)).mul(_batch.totalSellSpend)
        ) {
            return true;
        }

        return false;
    }

    /* initialization functions */

    function _currentBatch(address _collateral) internal returns (uint256, Batch storage) {
        uint256 batchId = _currentBatchId();
        MetaBatch storage metaBatch = metaBatches[batchId];
        Batch storage batch = metaBatch.batches[_collateral];

        if (!metaBatch.initialized) {
            /**
             * NOTE
             * all collateral batches should be initialized with the same supply to
             * avoid price manipulation between different collaterals in the same meta-batch
             * we don't need to do the same with collateral balances as orders against one collateral
             * can't affect the pool's balance against another collateral and tap is a step-function
             * of the meta-batch duration
            */

            /**
             * NOTE
             * realSupply(metaBatch) = totalSupply(metaBatchInitialization) + tokensToBeMinted(metaBatchInitialization)
             * 1. buy and sell orders incoming during the current meta-batch and affecting totalSupply or tokensToBeMinted
             * should not be taken into account in the price computation [they are already a part of the batched pricing computation]
             * 2. the only way for totalSupply to be modified during a meta-batch [outside of incoming buy and sell orders]
             * is for buy orders from previous meta-batches to be claimed [and tokens to be minted]:
             * as such totalSupply(metaBatch) + tokenToBeMinted(metaBatch) will always equal totalSupply(metaBatchInitialization) + tokenToBeMinted(metaBatchInitialization)
            */
            metaBatch.realSupply = curveSupply.add(tokensToBeMinted);
            metaBatch.buyFeePct = buyFeePct;
            metaBatch.sellFeePct = sellFeePct;
            metaBatch.formula = formula;
            metaBatch.initialized = true;

            emit NewMetaBatch(batchId, metaBatch.realSupply, metaBatch.buyFeePct, metaBatch.sellFeePct, address(metaBatch.formula));
        }

        if (!batch.initialized) {
            /**
             * NOTE
             * supply(batch) = realSupply(metaBatch) + virtualSupply(batchInitialization)
             * virtualSupply can technically be updated during a batch: the on-going batch will still use
             * its value at the time of initialization [it's up to the updater to act wisely]
            */

            /**
             * NOTE
             * balance(batch) = poolBalance(batchInitialization) - collateralsToBeClaimed(batchInitialization) + virtualBalance(metaBatchInitialization)
             * 1. buy and sell orders incoming during the current batch and affecting poolBalance or collateralsToBeClaimed
             * should not be taken into account in the price computation [they are already a part of the batched price computation]
             * 2. the only way for poolBalance to be modified during a batch [outside of incoming buy and sell orders]
             * is for sell orders from previous meta-batches to be claimed [and collateral to be transfered] as the tap is a step-function of the meta-batch duration:
             * as such poolBalance(batch) - collateralsToBeClaimed(batch) will always equal poolBalance(batchInitialization) - collateralsToBeClaimed(batchInitialization)
             * 3. virtualBalance can technically be updated during a batch: the on-going batch will still use
             * its value at the time of initialization [it's up to the updater to act wisely]
            */

            batch.supply = metaBatch.realSupply.add(collaterals[_collateral].virtualSupply);
            batch.balance = ERC20(_collateral).balanceOf(address(this)).add(collaterals[_collateral].virtualBalance).sub(collateralsToBeClaimed[_collateral]);
            batch.reserveRatio = collaterals[_collateral].reserveRatio;
            batch.slippage = collaterals[_collateral].slippage;
            batch.initialized = true;

            emit NewBatch(batchId, _collateral, batch.supply, batch.balance, batch.reserveRatio, batch.slippage);
        }

        return (batchId, batch);
    }

    /* state modifiying functions */

    function _open(bool _status) internal {
        isOpen = _status;

        emit Open(_status);
    }

    function _updateBeneficiary(address _beneficiary) internal {
        beneficiary = _beneficiary;

        emit UpdateBeneficiary(_beneficiary);
    }

    function _updateFormula(IBancorFormula _formula) internal {
        formula = _formula;

        emit UpdateFormula(address(_formula));
    }

    function _updateFees(uint256 _buyFeePct, uint256 _sellFeePct) internal {
        buyFeePct = _buyFeePct;
        sellFeePct = _sellFeePct;

        emit UpdateFees(_buyFeePct, _sellFeePct);
    }

    function _cancelCurrentBatch(address _collateral) internal {
        (uint256 batchId, Batch storage batch) = _currentBatch(_collateral);
        if (!batch.cancelled) {
            batch.cancelled = true;

            // bought bonds are cancelled but sold bonds are due back
            // bought collaterals are cancelled but sold collaterals are due back
            tokensToBeMinted = tokensToBeMinted.sub(batch.totalBuyReturn).add(batch.totalSellSpend);
            collateralsToBeClaimed[_collateral] = collateralsToBeClaimed[_collateral].add(batch.totalBuySpend).sub(batch.totalSellReturn);

            emit CancelBatch(batchId, _collateral);
        }
    }

    function _addCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage)
        internal
    {
        collaterals[_collateral].whitelisted = true;
        collaterals[_collateral].virtualSupply = _virtualSupply;
        collaterals[_collateral].virtualBalance = _virtualBalance;
        collaterals[_collateral].reserveRatio = _reserveRatio;
        collaterals[_collateral].slippage = _slippage;

        emit AddCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    function _removeCollateralToken(address _collateral) internal {
        _cancelCurrentBatch(_collateral);

        Collateral storage collateral = collaterals[_collateral];
        delete collateral.whitelisted;
        delete collateral.virtualSupply;
        delete collateral.virtualBalance;
        delete collateral.reserveRatio;
        delete collateral.slippage;

        emit RemoveCollateralToken(_collateral);
    }

    function _updateCollateralToken(
        address _collateral,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32  _reserveRatio,
        uint256 _slippage
    )
        internal
    {
        collaterals[_collateral].virtualSupply = _virtualSupply;
        collaterals[_collateral].virtualBalance = _virtualBalance;
        collaterals[_collateral].reserveRatio = _reserveRatio;
        collaterals[_collateral].slippage = _slippage;

        emit UpdateCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    function _openBuyOrder(address _buyer, address _collateral, uint256 _value) internal {
        (uint256 batchId, Batch storage batch) = _currentBatch(_collateral);

        // deduct fee
        uint256 fee = _value.mul(metaBatches[batchId].buyFeePct).div(PCT_BASE);
        uint256 value = _value.sub(fee);

        // collect fee and collateral
        if (fee > 0) {
            ERC20(_collateral).safeTransferFrom(_buyer, beneficiary, fee);
        }
        ERC20(_collateral).safeTransferFrom(_buyer, address(this), value);

        // save batch
        uint256 deprecatedBuyReturn = batch.totalBuyReturn;
        uint256 deprecatedSellReturn = batch.totalSellReturn;

        // update batch
        batch.totalBuySpend = batch.totalBuySpend.add(value);
        batch.buyers[_buyer] = batch.buyers[_buyer].add(value);

        // update pricing
        _updatePricing(batch, batchId, _collateral);

        // update the amount of tokens to be minted and collaterals to be claimed
        tokensToBeMinted = tokensToBeMinted.sub(deprecatedBuyReturn).add(batch.totalBuyReturn);
        collateralsToBeClaimed[_collateral] = collateralsToBeClaimed[_collateral].sub(deprecatedSellReturn).add(batch.totalSellReturn);

        // sanity checks
        require(_slippageIsValid(batch), ERROR_SLIPPAGE_EXCEEDS_LIMIT);

        emit OpenBuyOrder(_buyer, batchId, _collateral, fee, value);
    }

    function _openSellOrder(address _seller, address _collateral, uint256 _amount) internal {
        (uint256 batchId, Batch storage batch) = _currentBatch(_collateral);

        // burn bonds
        curveSupply -= _amount;
        token.burnFrom(_seller, _amount);

        // save batch
        uint256 deprecatedBuyReturn = batch.totalBuyReturn;
        uint256 deprecatedSellReturn = batch.totalSellReturn;

        // update batch
        batch.totalSellSpend = batch.totalSellSpend.add(_amount);
        batch.sellers[_seller] = batch.sellers[_seller].add(_amount);

        // update pricing
        _updatePricing(batch, batchId, _collateral);

        // update the amount of tokens to be minted and collaterals to be claimed
        tokensToBeMinted = tokensToBeMinted.sub(deprecatedBuyReturn).add(batch.totalBuyReturn);
        collateralsToBeClaimed[_collateral] = collateralsToBeClaimed[_collateral].sub(deprecatedSellReturn).add(batch.totalSellReturn);

        // sanity checks
        require(_slippageIsValid(batch), ERROR_SLIPPAGE_EXCEEDS_LIMIT);
        require(_poolBalanceIsSufficient(_collateral), ERROR_INSUFFICIENT_POOL_BALANCE);

        emit OpenSellOrder(_seller, batchId, _collateral, _amount);
    }

    function _claimBuyOrder(address _buyer, uint256 _batchId, address _collateral) internal {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];
        uint256 buyReturn = (batch.buyers[_buyer].mul(batch.totalBuyReturn)).div(batch.totalBuySpend);

        batch.buyers[_buyer] = 0;

        if (buyReturn > 0) {
            tokensToBeMinted = tokensToBeMinted.sub(buyReturn);
            curveSupply += buyReturn;
            token.mint(_buyer, buyReturn);
        }

        emit ClaimBuyOrder(_buyer, _batchId, _collateral, buyReturn);
    }

    function _claimSellOrder(address _seller, uint256 _batchId, address _collateral) internal {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];
        uint256 saleReturn = (batch.sellers[_seller].mul(batch.totalSellReturn)).div(batch.totalSellSpend);
        uint256 fee = saleReturn.mul(metaBatches[_batchId].sellFeePct).div(PCT_BASE);
        uint256 value = saleReturn.sub(fee);

        batch.sellers[_seller] = 0;

        if (value > 0) {
            collateralsToBeClaimed[_collateral] = collateralsToBeClaimed[_collateral].sub(saleReturn);
            ERC20(_collateral).safeTransfer(_seller, value);
        }
        if (fee > 0) {
            ERC20(_collateral).safeTransfer(beneficiary, fee);
        }


        emit ClaimSellOrder(_seller, _batchId, _collateral, fee, value);
    }

    function _claimCancelledBuyOrder(address _buyer, uint256 _batchId, address _collateral) internal {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];

        uint256 value = batch.buyers[_buyer];
        batch.buyers[_buyer] = 0;

        if (value > 0) {
            collateralsToBeClaimed[_collateral] = collateralsToBeClaimed[_collateral].sub(value);
            // Warning! Buy Fee not refunded here!
            ERC20(_collateral).safeTransfer(_buyer, value);
        }

        emit ClaimCancelledBuyOrder(_buyer, _batchId, _collateral, value);
    }

    function _claimCancelledSellOrder(address _seller, uint256 _batchId, address _collateral) internal {
        Batch storage batch = metaBatches[_batchId].batches[_collateral];

        uint256 amount = batch.sellers[_seller];
        batch.sellers[_seller] = 0;

        if (amount > 0) {
            tokensToBeMinted = tokensToBeMinted.sub(amount);
            curveSupply += amount;
            token.mint(_seller, amount);
        }

        emit ClaimCancelledSellOrder(_seller, _batchId, _collateral, amount);
    }

    function _updatePricing(Batch storage batch, uint256 _batchId, address _collateral) internal {
        // the situation where there are no buy nor sell orders can't happen [keep commented]
        // if (batch.totalSellSpend == 0 && batch.totalBuySpend == 0)
        //     return;

        // static price is the current exact price in collateral
        // per token according to the initial state of the batch
        // [expressed in PPM for precision sake]
        // => MSU/DAI price in PPM
        uint256 staticPricePPM = _staticPricePPM(batch.supply, batch.balance, batch.reserveRatio);

        // [NOTE]
        // if staticPrice is zero then resultOfSell [= 0] <= batch.totalBuySpend
        // so totalSellReturn will be zero and totalBuyReturn will be
        // computed normally along the formula

        // 1. we want to find out if buy orders are worth more sell orders [or vice-versa]
        // 2. we thus check the return of sell orders at the current exact price
        // 3. if the return of sell orders is larger than the pending buys,
        //    there are more sells than buys [and vice-versa]
        uint256 resultOfSell = batch.totalSellSpend.mul(staticPricePPM).div(uint256(PPM));

        if (resultOfSell > batch.totalBuySpend) {
            // >> sell orders are worth more than buy orders

            // 1. first we execute all pending buy orders at the current exact
            // price because there is at least one sell order for each buy order
            // 2. then the final sell return is the addition of this first
            // matched return with the remaining bonding curve return

            // the number of tokens bought as a result of all buy orders matched at the
            // current exact price [which is less than the total amount of tokens to be sold]
            batch.totalBuyReturn = batch.totalBuySpend.mul(uint256(PPM)).div(staticPricePPM);
            // the number of tokens left over to be sold along the curve which is the difference
            // between the original total sell order and the result of all the buy orders
            uint256 remainingSell = batch.totalSellSpend.sub(batch.totalBuyReturn);
            // the amount of collateral generated by selling tokens left over to be sold
            // along the bonding curve in the batch initial state [as if the buy orders
            // never existed and the sell order was just smaller than originally thought]
            uint256 remainingSellReturn = metaBatches[_batchId].formula.calculateSaleReturn(batch.supply, batch.balance, batch.reserveRatio, remainingSell);
            // the total result of all sells is the original amount of buys which were matched
            // plus the remaining sells which were executed along the bonding curve
            batch.totalSellReturn = batch.totalBuySpend.add(remainingSellReturn);
        } else {
            // >> buy orders are worth more than sell orders

            // 1. first we execute all pending sell orders at the current exact
            // price because there is at least one buy order for each sell order
            // 2. then the final buy return is the addition of this first
            // matched return with the remaining bonding curve return

            // the number of collaterals bought as a result of all sell orders matched at the
            // current exact price [which is less than the total amount of collateral to be spent]
            batch.totalSellReturn = resultOfSell;
            // the number of collaterals left over to be spent along the curve which is the difference
            // between the original total buy order and the result of all the sell orders
            uint256 remainingBuy = batch.totalBuySpend.sub(resultOfSell);
            // the amount of tokens generated by selling collaterals left over to be spent
            // along the bonding curve in the batch initial state [as if the sell orders
            // never existed and the buy order was just smaller than originally thought]
            uint256 remainingBuyReturn = metaBatches[_batchId].formula.calculatePurchaseReturn(batch.supply, batch.balance, batch.reserveRatio, remainingBuy);
            // the total result of all buys is the original amount of buys which were matched
            // plus the remaining buys which were executed along the bonding curve
            batch.totalBuyReturn = batch.totalSellSpend.add(remainingBuyReturn);
        }


        emit UpdatePricing(_batchId, _collateral, batch.totalBuySpend, batch.totalBuyReturn, batch.totalSellSpend, batch.totalSellReturn);
    }

}
