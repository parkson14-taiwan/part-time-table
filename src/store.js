import { firebaseConfig, isFirebaseConfigured } from "./firebase.js";

const STORAGE_KEY = "ptt-data";

const initialData = {
  users: [
    {
      id: "u-admin",
      name: "Admin Demo / 管理員示範",
      role: "admin",
      email: "admin@example.com",
    },
    {
      id: "u-lead",
      name: "Lead Chef / 主廚",
      role: "lead",
      email: "lead@example.com",
    },
    {
      id: "u-crew",
      name: "Crew Member / 夥伴",
      role: "crew",
      email: "crew@example.com",
    },
  ],
  events: [],
  timeEntries: [],
  adjustments: [],
  auditLogs: [],
  locks: [],
};

const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const loadLocal = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return structuredClone(initialData);
  }
  return JSON.parse(raw);
};

const saveLocal = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  notify();
};

const localStore = {
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => loadLocal(),
  setSnapshot: (data) => saveLocal(data),
};

let firebaseStore = null;

const initFirebase = async () => {
  if (!isFirebaseConfigured) {
    return null;
  }
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js"
  );
  const { getFirestore, collection, getDocs, doc, setDoc } = await import(
    "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js"
  );

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const collections = {
    users: "users",
    events: "events",
    timeEntries: "timeEntries",
    adjustments: "adjustments",
    auditLogs: "auditLogs",
    locks: "locks",
  };

  const fetchCollection = async (name) => {
    const snapshot = await getDocs(collection(db, collections[name]));
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  };

  const saveCollection = async (name, records) => {
    const writes = records.map((record) =>
      setDoc(doc(db, collections[name], record.id), record)
    );
    await Promise.all(writes);
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: async () => {
      const [users, events, timeEntries, adjustments, auditLogs, locks] =
        await Promise.all([
          fetchCollection("users"),
          fetchCollection("events"),
          fetchCollection("timeEntries"),
          fetchCollection("adjustments"),
          fetchCollection("auditLogs"),
          fetchCollection("locks"),
        ]);
      return {
        users,
        events,
        timeEntries,
        adjustments,
        auditLogs,
        locks,
      };
    },
    setSnapshot: async (data) => {
      await Promise.all([
        saveCollection("users", data.users),
        saveCollection("events", data.events),
        saveCollection("timeEntries", data.timeEntries),
        saveCollection("adjustments", data.adjustments),
        saveCollection("auditLogs", data.auditLogs),
        saveCollection("locks", data.locks),
      ]);
      notify();
    },
  };
};

export const getStore = async () => {
  if (firebaseStore) {
    return firebaseStore;
  }
  const maybeFirebase = await initFirebase();
  firebaseStore = maybeFirebase || localStore;
  return firebaseStore;
};

export const getSession = () => {
  return JSON.parse(sessionStorage.getItem("ptt-session") || "null");
};

export const setSession = (session) => {
  sessionStorage.setItem("ptt-session", JSON.stringify(session));
};
