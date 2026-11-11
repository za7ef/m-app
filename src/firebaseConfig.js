// Firebase project config (public client keys — security comes from Firestore rules).
// Leave apiKey empty to run the app in local-only mode.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAaVk6SQ53kF9PBWh4fA3j2nQVh6skDEJs',
  authDomain: 'm-app-d22bb.firebaseapp.com',
  projectId: 'm-app-d22bb',
  storageBucket: 'm-app-d22bb.firebasestorage.app',
  messagingSenderId: '428343042738',
  appId: '1:428343042738:web:f1b5742f536b2a31951fab',
};

// Google Sign-In (optional). iOS client ID from GoogleService-Info.plist (CLIENT_ID),
// web client ID from Firebase → Authentication → Google → Web SDK configuration.
export const GOOGLE = {
  iosClientId: '428343042738-g0v1jvkv6hgd8e2vkcubjb2tql5f74f4.apps.googleusercontent.com',
  webClientId: '428343042738-pt3uj577jqkikf7g40idk3cd7n6ne50q.apps.googleusercontent.com',
};
