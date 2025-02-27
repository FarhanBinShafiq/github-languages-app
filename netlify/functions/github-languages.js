let fetch;

exports.handler = async (event, context) => {
    if (!fetch) {
        // Dynamically import node-fetch for ES module compatibility
        fetch = (await import('node-fetch')).default;
    }

    const username = event.queryStringParameters.username;
    const token = process.env.GITHUB_TOKEN;  // Using the token from environment variable

    if (!username) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*'  // Allow all domains (or specify your domain here)
            },
            body: JSON.stringify({ error: 'Username is required' })
        };
    }

    if (!token) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*'  // Allow all domains (or specify your domain here)
            },
            body: JSON.stringify({ error: 'GitHub token is required' })
        };
    }

    try {
        // Include the token in the Authorization header for authenticated requests
        const headers = { Authorization: `token ${token}` };
        const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, { headers });

        if (!reposResponse.ok) throw new Error(`Failed to fetch repositories: ${reposResponse.statusText}`);

        const repos = await reposResponse.json();
        let languageData = {};

        const languageRequests = repos.map(repo =>
            fetch(repo.languages_url, { headers }).then(async res => {
                if (!res.ok) throw new Error(`Failed to fetch languages for repo ${repo.name}`);
                return res.json();
            })
        );

        const languages = await Promise.all(languageRequests);

        languages.forEach(repoLanguages => {
            for (const [lang, bytes] of Object.entries(repoLanguages)) {
                languageData[lang] = (languageData[lang] || 0) + bytes;
            }
        });

        const totalBytes = Object.values(languageData).reduce((acc, val) => acc + val, 0);
        const sortedLanguages = Object.entries(languageData)
            .map(([lang, bytes]) => ({ name: lang, percentage: ((bytes / totalBytes) * 100).toFixed(2) }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 6);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*'  // Allow all domains (or specify your domain here)
            },
            body: JSON.stringify(sortedLanguages)
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'  // Allow all domains (or specify your domain here)
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
