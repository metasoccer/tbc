require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require('hardhat-abi-exporter');
require("solidity-coverage");
require('dotenv').config()

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
  networks: {
    mumbai: {
      url: process.env.MUMBAI_URL,
      accounts: [`0x${process.env.MUMBAI_PRIV}`],
    },
    polygon: {
      url: process.env.POLYGON_URL,
      accounts: [`0x${process.env.MUMBAI_PRIV}`],
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: `${process.env.ETHERSCAN_APIKEY}`,
  }
};
