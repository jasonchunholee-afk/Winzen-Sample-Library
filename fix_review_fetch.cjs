const fs = require('fs');
let review = fs.readFileSync('src/components/Review.tsx', 'utf8');

// We want to add a useEffect to fetch the garments_data.json and merge it into MOCK_GARMENTS
// Actually, it's easier to just replace MOCK_GARMENTS entirely inside the component state.

const fetchLogic = `
  const [garments, setGarments] = useState<any[]>(MOCK_GARMENTS);
  
  import { useEffect } from 'react';
  
  // Replace export function Review() with:
  
`;

review = review.replace(
  "import { useState } from 'react';",
  "import { useState, useEffect } from 'react';"
);

review = review.replace(
  "export function Review() {",
  `export function Review() {
  const [garments, setGarments] = useState<any[]>(MOCK_GARMENTS);

  useEffect(() => {
    fetch('/garments_data.json')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const merged = MOCK_GARMENTS.map(mock => {
            const aiData = data.find((d: any) => d.id === mock.id);
            if (aiData) {
              return {
                ...mock,
                brand: aiData.brand || mock.brand,
                size: aiData.size || mock.size,
                description: aiData.description || mock.description,
                materials: aiData.materials || []
              };
            }
            return mock;
          });
          setGarments(merged);
        }
      })
      .catch(err => console.error("Failed to load AI data:", err));
  }, []);
`
);

// Now replace MOCK_GARMENTS with garments in the rendering loop.
review = review.replace(/MOCK_GARMENTS/g, "garments");
// Restore the initial state initialization since we replaced MOCK_GARMENTS with garments
review = review.replace("const [garments, setGarments] = useState<any[]>(garments);", "const [garments, setGarments] = useState<any[]>(MOCK_GARMENTS);");

// One specific replacement is `garments.map((id, index)` inside MOCK_GARMENTS init. We need to restore it.
review = review.replace(
  "const garments = GARMENT_IDS.map((id, index)",
  "const MOCK_GARMENTS = GARMENT_IDS.map((id, index)"
);

fs.writeFileSync('src/components/Review.tsx', review);
