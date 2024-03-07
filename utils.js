const generateConfig = (url, accessToken) => {
    return {
        method: "get",
        url: url,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "Content-type": "application/json"
        }
    }
}

module.exports = {generateConfig}