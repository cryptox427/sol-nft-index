const axios = require('axios');

const getMetaInfo = async (url) => {
    return new Promise(( async (resolve, reject) => {
        try {
            const result = await axios.get(url)
            // console.log('res--', result);
            resolve(result.data)
        } catch (e) {
            reject(e)
        }
    }))

}

module.exports = {
    getMetaInfo
}