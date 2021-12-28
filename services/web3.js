const {deserializeUnchecked} = require('borsh');
const {PublicKey, Connection} = require('@solana/web3.js');
const {getMetaInfo} = require('./metadata')

const ProgramIDS = {
    SPL_TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    METADATA: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
}

class Data {
    constructor({
        name,
        symbol,
        uri,
        sellerFeeBasisPoints,
        creators
    }) {
        this.name = name;
        this.symbol = symbol;
        this.uri = uri;
        this.sellerFeeBasisPoints = sellerFeeBasisPoints;
        this.creators = creators;
    }
}

class Creator {
    constructor({ address, verified, share}) {
        this.address = address;
        this.verified = verified;
        this.share = share;
    }
}

class Metadata {
    constructor({updateAuthority, mint, data,primarySaleHappened, isMutable, masterEdition}) {
        this.key = 4;
        this.updateAuthority = updateAuthority;
        this.mint = mint;
        this.data = data;
        this.primarySaleHappened = primarySaleHappened;
        this.isMutable = isMutable;
    }
}

const METADATA_SCHEMA = new Map([
    [
        Data,
        {
            kind: "struct",
            fields: [
                ["name", "string"],
                ["symbol", "string"],
                ["uri", "string"],
                ["sellerFeeBasisPoints", "u16"],
                ["creators", { kind: "option", type: [Creator] }],
            ],
        },
    ],
    [
        Creator,
        {
            kind: "struct",
            fields: [
                ["address", [32]],
                ["verified", "u8"],
                ["share", "u8"],
            ],
        },
    ],
    [
        Metadata,
        {
            kind: "struct",
            fields: [
                ["key", "u8"],
                ["updateAuthority", [32]],
                ["mint", [32]],
                ["data", Data],
                ["primarySaleHappened", "u8"],
                ["isMutable", "u8"],
            ],
        },
    ],
]);

/**
 *
 * @param owner : PublicKey
 * @param connection : Connection
 * @returns {Promise<void>}
 */
async function getNFTTokens(owner) {
    return new Promise((async (resolve, reject) => {
        try {
            const connection = new Connection(process.env.SOl_RPC_URL, 'confirmed');
            const result = await connection.getParsedTokenAccountsByOwner(new PublicKey(owner), {programId: new PublicKey(ProgramIDS.SPL_TOKEN)});
            console.log('length----', result)
            const ret = [];
            if (result && result.value && result.value.length) {
                for (let i = 0; i < result.value.length; i++) {
                    const data = result.value[i].account.data;
                    const {info: {mint, tokenAmount}} = data.parsed;
                    if (tokenAmount.uiAmount === 1) {
                        // mint should be the NFT token
                        try {
                            const metadata = await getMetadata(mint);
                            const {
                                data,
                                data: {uri}
                            } = metadata;
                            if (uri) {
                                ret.push({...data, token: mint});
                            }
                        }catch(exception){}
                    }
                }
            }
            resolve(ret)
        } catch (e) {
            reject(e)
        }
    }))

    // const sample = await getMetadata(new Connection('https://api.devnet.solana.com','confirmed'), '7m9gHwaYRd5BGmDedSM7pvEAfakqYbUnuNBhNVgreVB9')
    // return [sample];
}


/**
 * @param connection : Connection
 * @param mint : string
 * @returns {Promise<void>}
 */
async function getMetadata( mint) {
    const connection = new Connection(process.env.SOl_RPC_URL, 'confirmed');
    return new Promise((async (resolve, reject) => {
        try {
        const addresses = await PublicKey.findProgramAddress([
            Buffer.from('metadata'),
            new PublicKey(ProgramIDS.METADATA).toBuffer(),
            new PublicKey(mint).toBuffer(),
        ], new PublicKey(ProgramIDS.METADATA));
        if (addresses.length > 0) {
            const key = addresses[0];
            const accountInfo = await connection.getAccountInfo(key);
            const binaryData = accountInfo.data;

            // parse binary data
            const metadata = deserializeUnchecked(
                METADATA_SCHEMA,
                Metadata,
                binaryData
            );
            // console.log('metadata----', mint, metadata)

            metadata.data.name = metadata.data.name.replace(/\0/g, "");
            metadata.data.symbol = metadata.data.symbol.replace(/\0/g, "");
            metadata.data.uri = metadata.data.uri.replace(/\0/g, "");
            // console.log('metadata----', mint, metadata)
            resolve(metadata);
        }
        } catch (e) {
            // console.log('e', e)
            reject(e)
        }
    }))
}

const getNFTsByCollection = async (address) => {
    return new Promise((async (resolve, reject) => {
        try {
            const mints = [];
            const connection = new Connection(process.env.SOl_RPC_URL, 'confirmed');
            const signatures = await connection.getConfirmedSignaturesForAddress2(new PublicKey(address))
            console.log('signatures----', signatures)
            for (let i = 0; i < signatures.length; i++) {
                await sleep(200);
                const data = await connection.getConfirmedTransaction(signatures[i].signature)
                console.log('------data', JSON.stringify(data));
                if (data?.meta?.preTokenBalances) {
                    // eslint-disable-next-line array-callback-return
                    data.meta.preTokenBalances.map(mint => {
                        if (!mints.includes(mint)) mints.push({...mint, owner: data.transaction.feePayer.toString()})
                    })
                }
            }
            const sqlData = [];
            const owners = [];
            for (let i = 0; i < mints.length; i++) {
                await sleep(200);
                const metadata = await getMetadata(mints[i].mint);
                if (metadata.data.uri) {
                    // const data = await getMetaInfo(metadata.data.uri)
                    sqlData.push([
                        address,
                        mints[i].mint,
                        mints[i].owner,
                        null,
                        metadata.data.uri,
                        null
                    ])
                    // sqlData.push([data.image, JSON.stringify(data.attributes), code]);
                }
                if (!owners.includes(mints[i].mint)) owners.push(mints[i].mint)
            }
            resolve({data: sqlData, owners: owners})
        } catch (e) {
            console.log(e);
            reject(e);
        }

    }))

}
const sleep = ms => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const getMintTimestamp = (mint)  => {
    return new Promise((async resolve => {
        const connection = new Connection(process.env.SOl_RPC_URL, 'confirmed');
        const signatures = await connection.getSignaturesForAddress(new PublicKey(mint));
        resolve({mintTimestamp: signatures[signatures.length - 1].blockTime, updatedAt: signatures[0].blockTime})
    }))
}

const getSale = (mint) => {
    return new Promise((async resolve => {
        // console.log('mint-----', mint)
        const connection = new Connection(process.env.SOl_RPC_URL, 'confirmed');
        const signatures = await connection.getSignaturesForAddress(new PublicKey(mint));
        // console.log('signatures---', signatures);
        const signature = signatures[signatures.length - 1]
        // console.log('signature---', signature);
        const result = await connection.getParsedConfirmedTransaction(signature.signature)
        // console.log('result---', JSON.stringify(result))
        // console.log( result.meta.innerInstructions[result.meta.innerInstructions.length - 1].instructions[0].parsed.info);
        resolve({blockNumber: signature.slot, blockTimestamp: signature.blockTime, price: result.meta.innerInstructions[result.meta.innerInstructions.length - 1].instructions[0].parsed.info.lamports})
    }))
}

// getMetadata(new Connection('https://api.devnet.solana.com','confirmed'), '7m9gHwaYRd5BGmDedSM7pvEAfakqYbUnuNBhNVgreVB9').then(result => {
//     console.log(result);
// }).catch(error => {
//     console.log(error);
// });

const test = async (address) => {
    const connection = new Connection(process.env.SOl_RPC_URL, 'confirmed');

    const signatures = await connection.getSignaturesForAddress(new PublicKey('CfxLktqEiQ4XiNSqmW4UadNoSfUdDYfDDeqvJoQMpaU9'));
    console.log('signatures---', signatures);
    const signature = signatures[signatures.length - 1].signature
    console.log('signature---', signature);
    const result = await connection.getParsedConfirmedTransaction(signature)
    console.log('result---', JSON.stringify(result))
    console.log( result.meta.innerInstructions[result.meta.innerInstructions.length - 1].instructions[0].parsed.info);

    // const result = await connection.getParsedConfirmedTransaction(signature)
    // console.log('result---', JSON.stringify(result))
    // console.log( result.meta.innerInstructions[result.meta.innerInstructions.length - 1].instructions[0].parsed.info);

    // const signatures = await connection.getSignaturesForAddress(new PublicKey(address));
    // // console.log('signature', signatures)
    // const signature = signatures[0].signature
    // console.log('signature', signature)
    // const result = await connection.getParsedConfirmedTransaction(signature)
    // console.log('result---', JSON.stringify(result))
}

module.exports = {
    getNFTsByCollection,
    getNFTTokens,
    test,
    getMetadata,
    getMintTimestamp,
    getSale
}