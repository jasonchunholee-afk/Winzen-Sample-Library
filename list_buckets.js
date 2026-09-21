import { Storage } from '@google-cloud/storage';
const storage = new Storage({ projectId: 'gen-lang-client-0864948280' });
storage.getBuckets().then(([buckets]) => {
  console.log("Buckets:", buckets.map(b => b.name));
}).catch(e => console.error(e.message));
