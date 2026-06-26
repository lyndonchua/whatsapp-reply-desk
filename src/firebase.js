import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBXCicoFyE1nJ-FMVCpKLbAebG99Htog8U",
  authDomain: "whatsapp-reply-dashboard.firebaseapp.com",
  projectId: "whatsapp-reply-dashboard",
  storageBucket: "whatsapp-reply-dashboard.firebasestorage.app",
  messagingSenderId: "295173863947",
  appId: "1:295173863947:web:fa1f10b0d4f8be8d41250e"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
