# Mumbai

Test Curve MSU address: https://mumbai.polygonscan.com/address/0xcb016D39cd7608c37f1D8f4192Ec103242Bc456d \
Test Curve DAIs address: https://mumbai.polygonscan.com/address/0xC25ADc1344F4b35975CA828dbC8916aA6051c64b \
Bancor Formula address: https://mumbai.polygonscan.com/address/0x780017A34e0175F8bD3810B71A58Bd1C2C005911 \
Curve address: https://mumbai.polygonscan.com/address/0x79b3f8e6cBA5D17bB883aB61e8e0A80c71DB4eDa


# How to deploy
Launch deploy script: \
`npx hardhat run --network mumbai scripts/deploy.js`

Verify on Polygonscan with: \
`npx hardhat verify --network mumbai 0xcb016D39cd7608c37f1D8f4192Ec103242Bc456d 0x0Bae1695AD0034E0Eb1c121DF904AB919Ae4951A 360000000000000000000000000` \
`npx hardhat verify --network mumbai 0xC25ADc1344F4b35975CA828dbC8916aA6051c64b 0x0Bae1695AD0034E0Eb1c121DF904AB919Ae4951A 1000000000000000000000000000` \
`npx hardhat verify --network mumbai 0x780017A34e0175F8bD3810B71A58Bd1C2C005911` \
`npx hardhat verify --network mumbai 0x79b3f8e6cBA5D17bB883aB61e8e0A80c71DB4eDa 0x780017A34e0175F8bD3810B71A58Bd1C2C005911 0xcb016D39cd7608c37f1D8f4192Ec103242Bc456d 0x0Bae1695AD0034E0Eb1c121DF904AB919Ae4951A 118631941129017935042548644 60000000000000000000000000 50 2000000000000000 3000000000000000`
