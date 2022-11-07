require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-abi-exporter");
require("solidity-coverage");
require("dotenv").config();
require("@nomiclabs/hardhat-ganache");

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
      //url: `https://polygon-mumbai.infura.io/v3/beae48ddf884493687b786b6ef241311`,
      url: `https://polygon-mumbai.g.alchemy.com/v2/8gIA1F_rlhhHEOO8VN-aZuZd4N069h-6`,
      //url: process.env.ALCHEMY_MUMBAI_KEY,
      accounts: [
        `0x${process.env.MUMBAI_PRIV}`,
        `0x${process.env.MUMBAI_PRIV2}`,
      ],
      gasPrice: 7000000000,
      //gasLimit: 6000000000,
    },
    goerli: {
      url: process.env.ALCHEMY_GOERLI_KEY,
      accounts: [
        `0x${process.env.MUMBAI_PRIV}`,
        `0x${process.env.MUMBAI_PRIV2}`,
      ],
      //gasPrice: 8000000000,
    },
    polygon: {
      url: process.env.POLYGON_URL,
      accounts: [`0x${process.env.MUMBAI_PRIV}`],
    },
    // ganache: {
    //   gasLimit: 6000000000,
    //   defaultBalanceEther: 10,
    // },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: `${process.env.ETHERSCAN_APIKEY}`,
    //npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS "Constructor argument 1"
  },
};
