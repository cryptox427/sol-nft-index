const axios = require('axios');
const Pool = require('pg').Pool
const pool = new Pool({
    user: 'me',
    host: 'localhost',
    database: 'api',
    password: 'gentle',
    port: 5432,
})
const format = require('pg-format');
const {getNFTsByCollection, getNFTTokens, getMetadata, getMintTimestamp, getSale} = require('./web3');
const {getMetaInfo} = require('./metadata');

const getCollections = () => {
    return new Promise(((resolve, reject) => {
        axios.get(process.env.MARKET_URL)
            .then(async res => {
                // console.log(res)
                if (res.status === 100) {
                    let temp = res.data;
                    let data = []
                    for (let i = 0; i < temp.length; i++) {
                        const length = temp[i].updateAuth.length;
                        if (length > 10) {
                            if (!temp[i].updateAuth.split('"')[1]) continue;
                            data.push([
                                temp[i].updateAuth.split('"')[1],
                                true,
                                temp[i].name,
                                temp[i].name,
                                temp[i].url,
                                temp[i].img
                            ])
                            if (length > 60) {
                                if (!temp[i].updateAuth.split('"')[3]) continue;
                                data.push([
                                    temp[i].updateAuth.split('"')[1],
                                    true,
                                    temp[i].name,
                                    temp[i].name,
                                    temp[i].url,
                                    temp[i].img
                                ])
                                data.push([
                                    temp[i].updateAuth.split('"')[3],
                                    true,
                                    temp[i].name,
                                    temp[i].name,
                                    temp[i].url,
                                    temp[i].img
                                ])
                            }
                        }
                    }
                    // console.log('data----', data);
                    let collectionQuery = format('INSERT INTO collections (id, verified, name, symbol, slug, image) VALUES %L returning id', data);
                    const result = await pool.query(collectionQuery)
                    console.log('Get collections----', result.rows);
                    resolve()
                }
            }).catch(e => {
            console.log(e)
            reject(e)
        })
    }))

};

const getNFTs = () => {
    return new Promise(((resolve, reject) => {
        pool.query('SELECT * FROM collections offset 6 limit 1', async (error, results) => {
            if (error) {
                console.log(error)
                reject(error)
            }
            let ownersList = []
            for (let i = 0; i < results.rows.length; i++) {
                const tokens = await axios.get(`${process.env.SOLSCAN_PUB_URL}/account/tokens?account=${results.rows[i].id}`)
                // console.log('tokens', tokens.data)
                if (tokens.status === 200) {
                    for (let j = 0; j < tokens.data.length; j++) {
                        if (tokens.data[j].tokenAmount.decimals === 0) {
                            try {
                                let owner = null;
                                await sleep(100);
                                if (!tokens.data[j].tokenAddress) continue;
                                const metadata_onchain = await getMetadata(tokens.data[j].tokenAddress)
                                const {mintTimestamp, updatedAt} = await getMintTimestamp(tokens.data[j].tokenAddress)
                                const holders = await axios.get(`${process.env.SOLSCAN_PUB_URL}/token/holders?tokenAddress=${tokens.data[j].tokenAddress}`)
                                if (holders.status === 200 && holders.data.total) {
                                    for (let k = 0; k < holders.data.data.length; k++) {
                                        if (holders.data.data[k].amount === 1) owner = holders.data.data[k].owner;
                                    }
                                }
                                const tokenQuery = format('INSERT INTO tokens (collection, token_id, owner, mint_timestamp, token_uri, updated_at) VALUES %L returning id',
                                    [[results.rows[i].id, tokens.data[j].tokenAddress, owner, mintTimestamp, metadata_onchain.data.uri, updatedAt]]);
                                const result = await pool.query(tokenQuery)
                                console.log('Get New Token', {
                                    collection: results.rows[i].id,
                                    tokenId: tokens.data[j].tokenAddress,
                                    owner,
                                    mintTimestamp,
                                    tokenUri: metadata_onchain.data.uri,
                                    updatedAt
                                })
                                // console.log('result----', result.rows);
                                if (!ownersList.includes(owner)) ownersList.push(owner);
                            } catch (e) {
                            }
                        }
                    }
                }
                // const {data, owners} = await getNFTsByCollection(results.rows[i].id)
                // const tokenQuery = format('INSERT INTO tokens (id, verified, name, symbol, slug, image) VALUES %L returning id', data);
                // const result = await pool.query(tokenQuery)
                // console.log('result----', result);
                // ownersList.push(...owners)
            }
            resolve(ownersList)
        })
    }))
};

const getWallets = async () => {
    return new Promise((async (resolve, reject) => {
        try {
            pool.query('SELECT owner FROM tokens', async (error, results) => {
                if (error) {
                    console.log(error)
                    reject(error)
                }
                const owners = [...new Set(results.rows.map(el => el.owner))]
                // console.log('owners---', owners);
                for (let i = 0; i < owners.length; i++) {
                    try {
                        let data = []
                        await sleep(100);
                        // const result = await getNFTTokens('BiLSmeewsZXzvXBS34rFYkg6UvxzEh4Q17Yrd6EZMALP');
                        const result = await axios.get(`${process.env.SOLSCAN_PUB_URL}/account/tokens?account=${owners[i]}`)
                        const tokens = JSON.stringify(result.data.map(el => el.tokenAddress));
                        data.push([owners[i], JSON.stringify(tokens)])
                        const ownerQuery = format('INSERT INTO wallets (id, tokens) VALUES %L returning id', data);
                        const queryResult = await pool.query(ownerQuery)
                        console.log('Get New Wallet ----', {
                            wallet: owners[i],
                            tokens: JSON.stringify(tokens)
                        });
                    } catch (e) {
                    }
                }

                resolve();
            })
        } catch (e) {
            reject(e)
        }
    }))
}

getTokenTransfers = async () => {
    return new Promise((async (resolve, reject) => {
        try {
            pool.query('SELECT * FROM collections offset 6 limit 1', async (error, results) => {
                if (error) {
                    console.log(error)
                    reject(error)
                }
                for (let u = 0; u < results.rows.length; u++) {
                    await sleep(100);
                    try {
                        let hasNext = true;
                        let offset = 0;
                        do {
                            const result = await axios.get(`${process.env.SOLSCAN_URL}/account/token/txs?address=${results.rows[u].id}&offset=${offset}&limit=10`)
                            hasNext = result.data.data.tx.hasNext;
                            offset += 10;
                            // console.log('result--', result.data.data.tx.hasNext, offset)
                            let transactionId, collectionAddress, timestamp, fromAddress, toAddress, tokenId;
                            for (let i = 0; i < result.data.data.tx.transactions.length; i++) {
                                await sleep(100);
                                const tx = result.data.data.tx.transactions[i];
                                transactionId = tx.txHash;
                                collectionAddress = results.rows[u].id;
                                timestamp = tx.blockTime;
                                const transaction = await axios.get(`${process.env.SOLSCAN_URL}/transaction?tx=${tx.txHash}`);
                                // console.log('transaction----', transaction.data);
                                const instructions = transaction.data.innerInstructions[0].parsedInstructions;
                                if (instructions[0]?.extra) {
                                    const data = instructions[0].extra;
                                    fromAddress = data.sourceOwner;
                                    toAddress = data.destinationOwner;
                                    tokenId = data.tokenAddress;
                                } else {
                                    for (let j = 0; j < instructions.length; j++) {
                                        if (instructions[j].name && instructions[j].name === 'Initialize Account') {
                                            fromAddress = results.rows[u].id;
                                            toAddress = instructions[j].params.owner;
                                            tokenId = instructions[j].params.tokenAddress
                                        }
                                    }
                                }
                                const ttQuery = format('INSERT INTO token_transfers (transaction_id, collection_address, token_id, from_address, to_address, timestamp) VALUES %L returning id', [[transactionId, collectionAddress, tokenId, fromAddress, toAddress, timestamp]]);
                                const queryResult = await pool.query(ttQuery)
                                console.log('Get New TokenTransfer', {
                                    transactionId, collectionAddress, tokenId, fromAddress, toAddress, timestamp
                                })

                            }
                            await sleep(100);
                        } while (hasNext)

                    } catch (e) {
                    }
                }
            })
        } catch (e) {
            console.log(e);
            reject(e)
        }
        resolve();
    }))
}

const getTransactions = async (address) => {
    return new Promise((async (resolve, reject) => {
        try {
            pool.query('SELECT * FROM collections offset 6 limit 1', async (error, results) => {
                if (error) {
                    console.log(error)
                    reject(error)
                }
                for (let u = 0; u < results.rows.length; u++) {
                    try {
                        await sleep(100);
                        const transactions = await axios.get(`${process.env.SOLSCAN_PUB_URL}/account/transactions?account=${results.rows[u].id}&limit=220`);
                        for (let i = 0; i < transactions.data.length; i++) {
                            const data = transactions.data[i];
                            await sleep(100);
                            const id = data.txHash;
                            const blockNumber = data.slot;
                            const blockTimestamp = data.blockTime;
                            const fee = data.fee;
                            const collectionAddress = results.rows[u].id;
                            const ttQuery = format('INSERT INTO transactions (id, block_number, block_timestamp, fee, collection_address) VALUES %L returning id', [[id, blockNumber, blockTimestamp, fee, collectionAddress]]);
                            const queryResult = await pool.query(ttQuery)
                            console.log('Get New Transaction', {
                                id,
                                blockNumber,
                                blockTimestamp,
                                fee,
                                collectionAddress
                            })
                        }
                    } catch (e) {
                        console.log(e);
                    }
                }
                resolve();
            })
        }catch (e){
            console.log(e)
            reject(e)
        }
    }))

}

const getSales = () => {
    return new Promise(((resolve, reject) => {
        try {
            pool.query('SELECT * FROM tokens', async (error, results) => {
                if (error) {
                    console.log(error)
                    reject(error)
                }
                for (let i = 0; i < results.rows.length; i++) {
                    await sleep(100);
                    const {blockNumber, blockTimestamp, price} = await getSale(results.rows[i].token_id);
                    const ttQuery = format('INSERT INTO sales (token_id, block_number, block_timestamp, price) VALUES %L returning id', [[results.rows[i].token_id, blockNumber, blockTimestamp, price]]);
                    const queryResult = await pool.query(ttQuery)
                    console.log('Get New Sale', {
                        token_id: results.rows[i].token_id,
                        blockNumber,
                        blockTimestamp,
                        price
                    })
                }
                resolve()
            });
        } catch (e) {
            console.log(e);
            reject(e);
        }
    }))
}

const sleep = ms => {
    return new Promise((resolve => setTimeout(resolve, ms)))
}

module.exports = {
    getCollections,
    getNFTs,
    getWallets,
    getTokenTransfers,
    getTransactions,
    getSales
}