// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDkuPYKsjo5awBCIb3OuAFbv5pQVIM7ZmM",
  authDomain: "svalbard201-4d330.firebaseapp.com",
  projectId: "svalbard201-4d330",
  storageBucket: "svalbard201-4d330.firebasestorage.app",
  messagingSenderId: "215212172819",
  appId: "1:215212172819:web:724b375e4624e58c38c1e6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialise Realtime Database
export const db = getDatabase(app, "https://svalbard201-4d330-default-rtdb.europe-west1.firebasedatabase.app");
// src/firebase.js