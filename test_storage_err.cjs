const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes } = require('firebase/storage');

const cfg = {
  apiKey: "AIzaSyDXYNHvnMoHAzZKyQI_I-Mg4JA5yvp7oCE",
  projectId: "gen-lang-client-0864948280",
  storageBucket: "gen-lang-client-0864948280.firebasestorage.app"
};

async function test() {
  try {
    const app = initializeApp(cfg);
    const storage = getStorage(app);
    const fileRef = ref(storage, 'test.txt');
    await uploadBytes(fileRef, Buffer.from("hello world"));
  } catch (e) {
    console.log("Status:", e.status_);
    console.log("Server response:", e.customData);
    console.log("Full error:", e);
  }
}
test();
