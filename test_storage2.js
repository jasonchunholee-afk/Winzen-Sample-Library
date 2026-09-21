import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const app1 = initializeApp({
  storageBucket: 'gen-lang-client-0864948280.appspot.com'
});

const bucket = getStorage(app1).bucket();
bucket.getFiles().then(files => {
  console.log("appspot access successful.");
}).catch(e => {
  console.error("appspot Error:", e.message);
});
