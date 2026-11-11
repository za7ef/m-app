import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth, getAuth, getReactNativePersistence, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut as fbSignOut, deleteUser, GoogleAuthProvider,
  signInWithCredential, EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, memoryLocalCache } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './firebaseConfig';

export const cloudEnabled = !!FIREBASE_CONFIG.apiKey;

let app, auth, db;
function init() {
  if (!cloudEnabled) return false;
  if (app) return true;
  app = getApps()[0] || initializeApp(FIREBASE_CONFIG);
  try { auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }); } catch { auth = getAuth(app); }
  // RN has no IndexedDB: Firestore keeps a memory cache; the app's own AsyncStorage state is the offline copy.
  db = initializeFirestore(app, { localCache: memoryLocalCache(), experimentalAutoDetectLongPolling: true });
  return true;
}

export function onUser(cb) {
  if (!init()) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, cb);
}

export const signUp = (email, pass) => (init(), createUserWithEmailAndPassword(auth, email.trim(), pass));
export const signIn = (email, pass) => (init(), signInWithEmailAndPassword(auth, email.trim(), pass));
export const resetPassword = (email) => (init(), sendPasswordResetEmail(auth, email.trim()));
export const signOut = () => (init() ? fbSignOut(auth) : Promise.resolve());
export const signInGoogle = (idToken, accessToken) => (init(), signInWithCredential(auth, GoogleAuthProvider.credential(idToken || null, accessToken || null)));

const stateRef = (uid) => doc(db, 'users', uid, 'app', 'state');

export async function pullCloud(uid) {
  init();
  const s = await getDoc(stateRef(uid));
  return s.exists() ? s.data() : null;
}
export async function pushCloud(uid, payload) {
  init();
  await setDoc(stateRef(uid), payload);
}
export function watchCloud(uid, cb) {
  init();
  return onSnapshot(stateRef(uid), (s) => { if (s.exists() && !s.metadata.hasPendingWrites) cb(s.data()); }, () => {});
}

// Deletes the user's Firestore data, then the auth user. Email accounts may need the password again.
export async function deleteAccount(password) {
  init();
  const u = auth.currentUser;
  if (!u) return;
  if (password && u.email) await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
  await deleteDoc(stateRef(u.uid));
  await deleteUser(u);
}

export function authErrorKey(e) {
  const c = (e && e.code) || '';
  if (/invalid-email/.test(c)) return 'errEmail';
  if (/user-not-found|invalid-credential|wrong-password|invalid-login/.test(c)) return 'errCreds';
  if (/email-already-in-use/.test(c)) return 'errInUse';
  if (/weak-password/.test(c)) return 'errWeak';
  if (/network/.test(c)) return 'errNetwork';
  if (/too-many-requests/.test(c)) return 'errTooMany';
  if (/requires-recent-login/.test(c)) return 'errRecent';
  return 'errGeneric';
}
