const fs = require('fs');
let review = fs.readFileSync('src/components/Review.tsx', 'utf8');

const newFetchLogic = `
  useEffect(() => {
    fetch('/garments_data.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const formatted = data.map((aiData: any) => ({
            id: aiData.id,
            brand: aiData.buyer || 'Unknown',
            description: aiData.description || '',
            size: aiData.size || '',
            location: 'Vault — 0001',
            images: [
              { role: 'Front', url: \`/images_thumb/\${aiData.id} (F).jpg\`, fullUrl: \`/images_ai/\${aiData.id} (F).jpg\`, fallbackUrl: \`/images/\${aiData.id} (F).jpg\` },
              { role: 'Back', url: \`/images_thumb/\${aiData.id} (B).jpg\`, fullUrl: \`/images_ai/\${aiData.id} (B).jpg\`, fallbackUrl: \`/images/\${aiData.id} (B).jpg\` },
              { role: 'Label', url: \`/images_thumb/\${aiData.id}.jpg\`, fullUrl: \`/images_ai/\${aiData.id}.jpg\`, fallbackUrl: \`/images/\${aiData.id}.jpg\` }
            ],
            status: 'pending',
            ...aiData
          }));
          setGarments(formatted);
        }
      })
      .catch(err => console.error("Failed to load AI data:", err));
  }, []);
`;

review = review.replace(/const GARMENT_IDS = \[[\s\S]*?\];/g, '');
review = review.replace(/const MOCK_GARMENTS = GARMENT_IDS\.map\([\s\S]*?\}\)\);/g, '');
review = review.replace("const [garments, setGarments] = useState<any[]>(MOCK_GARMENTS);", "const [garments, setGarments] = useState<any[]>([]);");
review = review.replace(/useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/g, newFetchLogic);

fs.writeFileSync('src/components/Review.tsx', review);
