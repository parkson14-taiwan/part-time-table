export const firebaseConfig = {
  apiKey: "AIzaSyByrugAyxH1aRe385WzPwS6trHHvaYrRvI",
  authDomain: "part-time-table.firebaseapp.com",
  projectId: "part-time-table",
  storageBucket: "part-time-table.firebasestorage.app",
  messagingSenderId: "834127525152",
  appId: "1:834127525152:web:1d117b2d5b11d5fc2a1345",
  measurementId: "G-4XLNMZDDJJ",
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value && !value.startsWith("YOUR_")
);
