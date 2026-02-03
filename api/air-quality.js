
export default async function handler(req, res) {
    try {
        const apiUrl = 'http://air4thai.pcd.go.th/forappV2/getAQI_JSON.php';
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`Air4Thai API responded with status: ${response.status}`);
        }

        const data = await response.json();

        // Set cache headers to avoid hitting the API too frequently
        res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=600');
        res.status(200).json(data);
    } catch (error) {
        console.error('Air Quality API Error:', error);
        res.status(500).json({ error: 'Failed to fetch air quality data' });
    }
}
