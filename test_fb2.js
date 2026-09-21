import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const app1 = initializeApp({
  storageBucket: 'gen-lang-client-0864948280.firebasestorage.app'
});
const bucket1 = getStorage(app1).bucket();
bucket1.getFiles().then(() => console.log("Success with firebasestorage.app")).catch(e => console.error("Error with firebasestorage.app", e.message));

const app2 = initializeApp({
  storageBucket: 'gen-lang-client-0864948280.appspot.com'
}, 'app2');
const bucket2 = getStorage(app2).bucket();
bucket2.getFiles().then(() => console.log("Success with appspot.com")).catch(e => console.error("Error with appspot.com", e.message));

