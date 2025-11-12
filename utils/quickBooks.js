const axios = require('axios');

async function fetchQuickBooksData(accessToken, companyId, query) {
    try {
        const url = `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}/query`;
        const response = await axios.get(url, {
            params: { query, minorversion: 75 },
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        return response.data;
    } catch (err) {
        console.error('QuickBooks API error:', err.response?.data || err.message);
        throw err;
    }
}

async function get_date(value) {
    const currentDate = new Date();
    if(value === "previous36months"){
    currentDate.setMonth(currentDate.getMonth() - 36); // subtract 36 months
    }else{
    currentDate.setDate(currentDate.getDate() - 1); // subtract 30 days
    }

    const formattedDate = currentDate.toISOString(); // "YYYY-MM-DD"
    return formattedDate;
}

module.exports = {
    fetchQuickBooksData,
    get_date
};
