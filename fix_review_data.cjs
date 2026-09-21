const fs = require('fs');
let review = fs.readFileSync('src/components/Review.tsx', 'utf8');

const newFetchLogic = `
  useEffect(() => {
    fetch('/api/garments')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setGarments(data);
        }
      })
      .catch(err => console.error("Failed to load AI data:", err));
  }, []);
`;

review = review.replace(/useEffect\(\(\) => \{[\s\S]*?fetch\('\/api\/garments'\)[\s\S]*?\}, \[\]\);/g, newFetchLogic.trim());

fs.writeFileSync('src/components/Review.tsx', review);
