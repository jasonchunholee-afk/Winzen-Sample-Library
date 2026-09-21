import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

async function test() {
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  const app = initializeApp(config);
  const storage = getStorage(app);
  const storageRef = ref(storage, 'test.txt');
  try {
    await uploadString(storageRef, 'hello world');
    const url = await getDownloadURL(storageRef);
    console.log('Success:', url);
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}
test();
