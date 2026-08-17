// Secure server-side proxy for Sentry. The auth token stays in Vercel env vars.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'SENTRY_AUTH_TOKEN is not configured' });
  }

  const organization = process.env.SENTRY_ORG || 'tbr-20';
  const project = process.env.SENTRY_PROJECT || 'tbr-2-0';
  const limit = Math.min(Math.max(Number(req.query?.limit || 10), 1), 50);

  const url = new URL(`https://sentry.io/api/0/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/issues/`);
  url.searchParams.set('limit', String(limit));
  if (req.query?.query) url.searchParams.set('query', String(req.query.query));

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Sentry API request failed',
        status: response.status,
        details: data
      });
    }

    const issues = Array.isArray(data) ? data.map(issue => ({
      id: issue.id,
      shortId: issue.shortId,
      title: issue.title,
      culprit: issue.culprit,
      level: issue.level,
      status: issue.status,
      count: issue.count,
      userCount: issue.userCount,
      firstSeen: issue.firstSeen,
      lastSeen: issue.lastSeen,
      permalink: issue.permalink
    })) : data;

    return res.status(200).json({ ok: true, organization, project, issues });
  } catch (error) {
    console.error('Sentry proxy error:', error);
    return res.status(502).json({ error: 'Unable to reach Sentry' });
  }
};
