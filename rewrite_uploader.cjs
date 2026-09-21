const fs = require('fs');
let code = fs.readFileSync('src/components/BulkUploader.tsx', 'utf8');

const replacement = `  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setProgress(0);
    setCompleted(0);
    
    const { storage } = await import('../firebase');
    const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const parsed = file.name.split('.');
      const ext = parsed.pop();
      const name = parsed.join('.');
      const garmentId = name.split(' ')[0] || 'UNKNOWN';
      const role = name.includes('(F)') ? 'Front' : name.includes('(B)') ? 'Back' : 'Label';
      
      const storageRef = ref(storage, \`images/\${name}_\${Date.now()}.\${ext}\`);
      
      try {
        const uploadTask = await uploadBytesResumable(storageRef, file);
        const downloadURL = await getDownloadURL(uploadTask.ref);
        
        await fetch('/api/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            garmentId,
            role,
            filename: file.name,
            url: downloadURL
          })
        });
      } catch (err) {
        console.error("Failed to upload", file.name, err);
      }
      
      setCompleted(i + 1);
      setProgress(((i + 1) / files.length) * 100);
    }

    setUploading(false);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };`;

code = code.replace(/  const handleUpload = async \(\) => \{[\s\S]*?setTimeout\(\(\) => \{\n      window\.location\.reload\(\);\n    \}, 1500\);\n  \};/, replacement);

fs.writeFileSync('src/components/BulkUploader.tsx', code);
