// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCDxs2hYnPUuaotZJ8ehHCfNgDFrVTC8is",
  authDomain: "frichef.firebaseapp.com",
  projectId: "frichef",
  storageBucket: "frichef.firebasestorage.app",
  messagingSenderId: "328830307360",
  appId: "1:328830307360:web:e68285149bf601a6444045",
  measurementId: "G-GRZDCSK9CK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);