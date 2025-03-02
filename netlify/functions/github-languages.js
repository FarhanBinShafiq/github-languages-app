let fetch;

exports.handler = async (event, context) => {
    if (!fetch) {
        // Dynamically import node-fetch for ES module compatibility
        fetch = (await import('node-fetch')).default;
    }

    const username = event.queryStringParameters.username;
    const token = process.env.GITHUB_TOKEN; // Using the token from environment variable

    if (!username) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Username is required' })
        };
    }

    if (!token) {
        return {
            statusCode: 400,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'GitHub token is required' })
        };
    }

    try {
        const headers = { Authorization: `token ${token}` };
        const reposResponse = await fetch(
            `https://api.github.com/users/${username}/repos?per_page=100`,
            { headers }
        );

        if (!reposResponse.ok) {
            throw new Error(`Failed to fetch repositories: ${reposResponse.statusText}`);
        }

        const repos = await reposResponse.json();

        let languageData = {};
        let totalStars = 0, totalCommits = 0, totalPRs = 0, totalIssues = 0;

        const languageRequests = repos.map(async repo => {
            const langResponse = await fetch(repo.languages_url, { headers });
            if (langResponse.ok) {
                const repoLanguages = await langResponse.json();
                for (const [lang, bytes] of Object.entries(repoLanguages)) {
                    languageData[lang] = (languageData[lang] || 0) + bytes;
                }
            }

            totalStars += repo.stargazers_count;

            const commitsResponse = await fetch(repo.commits_url.replace('{/sha}', ''), { headers });
            if (commitsResponse.ok) {
                const commits = await commitsResponse.json();
                totalCommits += commits.length;
            }

            const prsResponse = await fetch(repo.pulls_url.replace('{/number}', ''), { headers });
            if (prsResponse.ok) {
                const prs = await prsResponse.json();
                totalPRs += prs.length;
            }

            const issuesResponse = await fetch(repo.issues_url.replace('{/number}', ''), { headers });
            if (issuesResponse.ok) {
                const issues = await issuesResponse.json();
                totalIssues += issues.length;
            }
        });

        await Promise.all(languageRequests);

        const totalBytes = Object.values(languageData).reduce((acc, val) => acc + val, 0);
        const sortedLanguages = Object.entries(languageData)
            .map(([lang, bytes]) => ({
                name: lang,
                percentage: ((bytes / totalBytes) * 100).toFixed(2)
            }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 6);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                languages: sortedLanguages,
                stats: {
                    totalStars,
                    totalCommits,
                    totalPRs,
                    totalIssues
                }
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
