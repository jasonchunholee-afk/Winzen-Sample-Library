const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const fs = require('fs');

const config1 = {
  apiKey: "AIzaSyDXYNHvnMoHAzZKyQI_I-Mg4JA5yvp7oCE",
  projectId: "gen-lang-client-0864948280",
  storageBucket: "gen-lang-client-0864948280.firebasestorage.app"
};

const config2 = {
  apiKey: "AIzaSyDXYNHvnMoHAzZKyQI_I-Mg4JA5yvp7oCE",
  projectId: "gen-lang-client-0864948280",
  storageBucket: "gen-lang-client-0864948280.appspot.com"
};

async function test(name, cfg) {
  try {
    const app = initializeApp(cfg, name);
    const storage = getStorage(app);
    const fileRef = ref(storage, 'test.txt');
    await uploadBytes(fileRef, Buffer.from("hello world"));
    const url = await getDownloadURL(fileRef);
    console.log(`SUCCESS for ${cfg.storageBucket}:`, url);
  } catch (e) {
    console.log(`FAILED for ${cfg.storageBucket}:`, e.code, e.message);
  }
}

async function run() {
  await test('b1', config1);
  await test('b2', config2);
}
run();
