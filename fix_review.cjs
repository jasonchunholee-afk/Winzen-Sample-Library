const fs = require('fs');
let review = fs.readFileSync('src/components/Review.tsx', 'utf8');

if (!review.includes('BulkUploader')) {
  // Add import
  review = review.replace(
    "import { GarmentDetail } from './GarmentDetail';", 
    "import { GarmentDetail } from './GarmentDetail';\nimport { BulkUploader } from './BulkUploader';"
  );
  
  // Add state
  review = review.replace(
    "const [gridCols, setGridCols] = useState<number>(4);",
    "const [gridCols, setGridCols] = useState<number>(4);\n  const [showUploader, setShowUploader] = useState(false);"
  );

  // Add button to top bar
  const topBarReplacement = `
        <div className="flex gap-8">
          <button
`;
  const topBarNew = `
        <div className="flex items-center gap-4">
          <button onClick={() => setShowUploader(true)} className="px-4 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-black transition-colors text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
            Upload Batch
          </button>
        </div>
        <div className="flex gap-8">
          <button
`;
  review = review.replace(topBarReplacement, topBarNew);
  
  // Add component render
  review = review.replace(
    "return (",
    "return (\n    <>\n      {showUploader && <BulkUploader onClose={() => setShowUploader(false)} />}"
  );
  review = review.replace(
    "    </div>\n  );\n}",
    "    </div>\n    </>\n  );\n}"
  );

  fs.writeFileSync('src/components/Review.tsx', review);
}
