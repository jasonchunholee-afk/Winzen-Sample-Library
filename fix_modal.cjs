const fs = require('fs');

let devCode = fs.readFileSync('src/components/Developer.tsx', 'utf8');

const devModal = `      {selectedGarment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Review & Approve - {selectedGarment.id}</h3>
            
            <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
              {selectedGarment.images?.map((img: any) => (
                <img key={img.id} src={img.url || img.fallbackUrl} alt={img.role} className="w-32 h-32 object-cover rounded-lg border border-neutral-200" />
              ))}
            </div>

            <div className="bg-neutral-50 p-4 rounded-lg text-sm text-neutral-700 mb-6 whitespace-pre-wrap">
              <h4 className="font-bold text-neutral-900 mb-2">Structural Feedback</h4>
              {selectedGarment.structural_feedback || 'No feedback provided.'}
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setSelectedGarment(null)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleApprove(selectedGarment.id)}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}`;
devCode = devCode.replace(/      \{selectedGarment && \([\s\S]*?      \}\)/, devModal);

fs.writeFileSync('src/components/Developer.tsx', devCode);
