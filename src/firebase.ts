import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  projectId: "gen-lang-client-0864948280",
  appId: "1:53571111912:web:1cd3267c6ec6f9a3e1b25d",
  apiKey: "AIzaSyDXYNHvnMoHAzZKyQI_I-Mg4JA5yvp7oCE",
  authDomain: "gen-lang-client-0864948280.firebaseapp.com",
  storageBucket: "gen-lang-client-0864948280.firebasestorage.app",
  messagingSenderId: "53571111912"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Authenticate anonymously so we can upload to Storage with default rules
signInAnonymously(auth).catch((error) => {
  console.error("Firebase Anonymous Auth failed:", error);
});
