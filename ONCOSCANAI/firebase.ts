import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            "AIzaSyAfU7mM1qLlI8pKsfq_IbkTobnVeoM8poQ",
  authDomain:        "oncoscanai-d2d0b.firebaseapp.com",
  projectId:         "oncoscanai-d2d0b",
  storageBucket:     "oncoscanai-d2d0b.firebasestorage.app",
  messagingSenderId: "175081332330",
  appId:             "1:175081332330:web:4f7f69c61173266be8b413",
  measurementId:     "G-TBRHGWNV19",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
