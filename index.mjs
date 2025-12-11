import fs from 'fs'
// Fetch all users in all organisations and return users with their organisation domain and IDs who are using a specific app version.

// --- Configuration ---
const RINGOTEL_BASE_URL = 'https://shell.ringotel.co/api';
const API_KEY = process.env.API_KEY || 'YOUR_RINGOTEL_API_KEY';
const LIMIT = process.env.LIMIT || null;
// UPDATE WITH YOUR OWN PARAMETERS BEFORE RUNNING THE SCRIPT
const APP_VERSION = process.env.APP_VERSION || "5.5.09.04"; // Example: "5.5.09.04"

// DON'T UPDATE THE SCRIPT BELOW THIS LINE

/**
 * Helper function to handle fetch requests.
 * @param {string} url - The full URL to fetch.
 * @param {object} options - The options for the fetch request.
 * @returns {Promise<object|null>} JSON response or null on error.
 */
async function fetchData(url, options) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            let errorBody = 'No additional error details.';
            try {
                errorBody = await response.json();
            } catch (e) {
                errorBody = await response.text();
            }
            console.error(`API Error: ${response.status} ${response.statusText} for ${options.method} ${url}`);
            console.error(`Details: ${typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody, null, 2)}`);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`Network error during fetch to ${url}:`, error.message);
        return null;
    }
}

/**
 * Fetches all organisations. Uses POST as requested.
 * @returns {Promise<Array<Object>>} Array of organisation objects.
 */
async function getOrganisations() {
    const options = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            method: "getOrganizations"
        })
    };
    console.log('Fetching organisations...');
    const response = await fetchData(RINGOTEL_BASE_URL, options);
    if (response && response.result) {
        console.log(`Found ${response.result.length} organisations.`);
        return response.result;
    }
    console.error('Could not retrieve organisations.');
    return [];
}

/**
 * Fetches all users in a given organisation.
 * @param {string} orgId - The ID of the organisation.
 * @returns {Promise<Array<Object>>} Array of user objects.
 */
async function getUsersInOrganisation(orgid) {
    const options = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            method: "getUsers",
            params: {
                orgid
            }
        })
    };
    const response = await fetchData(RINGOTEL_BASE_URL, options);
    if (response && response.result) {
        return response.result;
    }
    console.error(`Could not retrieve users for organisation ID: ${orgid}.`);
    return [];
}

/**
 * Main function to find users with the specified app version.
 */
async function findUsersByAppVersion() {
    if (!API_KEY || !APP_VERSION) {
        console.error('API_KEY and APP_VERSION must be set.');
        return;
    }

    console.log(`Starting search for users with app version: ${APP_VERSION}`);
    const organisations = await getOrganisations();
    if (organisations.length === 0) {
        console.log('No organisations to process.');
        return;
    }
    const usersWithAppVersion = [];

    for (let i = 0; i < organisations.length; i++) {
        const orgId = organisations[i].id;
        const orgDomain = organisations[i].domain || 'N/A';
        console.log(`${i + 1}: Fetching users for organisation ID: ${orgId}...`);
        const users = await getUsersInOrganisation(orgId);
        console.log(`Found ${users.length} users in organisation ID: ${orgId}.`);
        for (const user of users) {
            if (user.devs) {
                for (const dev of user.devs) {
                    // Check if the user is using the specified app version
                    if (dev.ua && dev.ua.match(APP_VERSION)) {

                        usersWithAppVersion.push({
                            orgDomain,
                            orgId,
                            userId: user.id,
                            userName: user.name || 'N/A',
                            userEmail: (user.info && user.info.email) || 'N/A',
                            deviceId: dev.id || 'N/A',
                            deviceIp: dev.ip || 'N/A',
                            appVersion: dev.ua
                        });
                    }
                }
            }
        }
        if (LIMIT && i >= LIMIT - 1) {
            break;
        }
    }

    if (usersWithAppVersion.length > 0) {
        console.log(`Users with app version ${APP_VERSION}:`);
        // console.table(usersWithAppVersion);
        // Write into a CSV file
        const csv = usersWithAppVersion.map(user => Object.values(user)).join('\n');
        // Add headers row
        const headers = Object.keys(usersWithAppVersion[0]).join(',');
        fs.writeFileSync('users_with_app_version.csv', headers + '\n' + csv);
    } else {
        console.log(`No users found with app version ${APP_VERSION}.`);
    }
}

// Run the main function
findUsersByAppVersion().catch(error => {
    console.error('An unexpected error occurred:', error);
});

