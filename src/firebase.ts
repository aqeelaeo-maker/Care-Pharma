import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = (firebaseConfig as any).firestoreDatabaseId 
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export const getStoreCollection = (collectionName: string) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Not authenticated");
  return collection(db, 'stores', user.email.toLowerCase(), collectionName);
};

export const getStoreDoc = (collectionName: string, docId?: string) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Not authenticated");
  if (docId) return doc(db, 'stores', user.email.toLowerCase(), collectionName, docId);
  return doc(collection(db, 'stores', user.email.toLowerCase(), collectionName)); // Generates a new doc ref if no docId provided
};
