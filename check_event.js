const crypto = require('crypto');

function keccak256(input) {
    const hash = crypto.createHash('sha3-256'); // Wait, sha3-256 is NOT keccak256. Node's built-in crypto might not have keccak256 straight up in older versions, but 'sha3-256' is standard SHA3, while Ethereum uses Keccak (pre-standard).
    // Actually, Node 20 or modern node doesn't expose strict Keccak easily without 'keccak' package or 'ethers'.
    // I assumed 'ethers' is available because it's in package.json usually in these environments.
    // If not, I can try to use a simple JS implementation or just use 'ethers' from the project node_modules.
    try {
        const { id } = require('ethers'); // Check availability
        return require('ethers').keccak256(require('ethers').toUtf8Bytes(input));
    } catch (e) {
        // Fallback? I'll assume ethers is available as it is used in the project.
        // If not, I'll fail. But the user has 'npm run dev' running, so node_modules exist.
        // Wait, 'ethers' might be devDependency or not in root?
        // zama-dashboard has package.json. I should run this script INSIDE zama-dashboard directory.
    }
}

const events = [
    'Deposit(address,uint256)',
    'Deposit(address,uint256,bytes)',
    'Shield(address,uint256)',
    'Shield(address,uint256,bytes)',
    'Shield(address,uint256,bytes32)',
    'LogDeposit(address,uint256)',
    'UserDeposit(address,uint256)',
    'DepositTo(address,uint256)',
    'Mint(address,uint256)',
    'LogTransfer(address,address,uint256)'
];

const { keccak256: ethersKeccak, toUtf8Bytes } = require('ethers');

events.forEach(e => {
    console.log(`${e}: ${ethersKeccak(toUtf8Bytes(e))}`);
});
