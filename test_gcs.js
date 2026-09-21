import { Storage } from '@google-cloud/storage';
const storage = new Storage();
storage.createBucket('gen-lang-client-0864948280-storage').then(() => console.log('created')).catch(e => console.error(e));
