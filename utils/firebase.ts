/**
 * Firebase Firestore Cloud Sync Module - v1.0.1
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  getFirestore,
  initializeFirestore,
  doc, 
  onSnapshot, 
  setDoc, 
  getDocFromServer,
  Unsubscribe,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ShiftEntry, Personnel, PublishedRange } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface CloudRosterState {
  schedule: ShiftEntry[];
  personnelList: Personnel[];
  unlockedMonths: string[];
  publishedRange: PublishedRange | null;
  adminPassword?: string;
  updatedAt: string;
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

// Initialize Firestore with explicit database ID from config
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Validate initial connection to Firestore backend per skill instructions
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore running in offline/cached mode.");
    }
    return false;
  }
}

if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}

const ROSTER_DOC_PATH = 'roster_state';
const ROSTER_DOC_ID = 'current';

// Subscribes to real-time changes of the roster in Firestore.
// Automatically synchronizes with local cache while offline and updates when online.
export function subscribeToCloudRoster(
  onUpdate: (data: CloudRosterState) => void,
  onInitialEmpty?: () => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const docRef = doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID);
  let isCancelled = false;

  const unsubscribe = onSnapshot(
    docRef,
    { includeMetadataChanges: false },
    (snapshot) => {
      if (isCancelled) return;
      if (snapshot.exists()) {
        const data = snapshot.data() as CloudRosterState;
        onUpdate(data);
      } else {
        if (onInitialEmpty) {
          onInitialEmpty();
        }
      }
    },
    (error) => {
      if (isCancelled) return;
      const isPermissionDenied =
        (error as any)?.code === 'permission-denied' ||
        (error instanceof Error && error.message.toLowerCase().includes('permission'));

      if (isPermissionDenied) {
        try {
          handleFirestoreError(error, OperationType.GET, `${ROSTER_DOC_PATH}/${ROSTER_DOC_ID}`);
        } catch (formattedErr) {
          if (onError) onError(formattedErr);
        }
      } else {
        // Non-fatal network / temporary offline notice - Firestore operates with local cache
        console.warn('Firestore connectivity status:', error?.message || error);
        if (onError) onError(error);
      }
    }
  );

  return () => {
    isCancelled = true;
    unsubscribe();
  };
}

/**
 * Sanitizes an object before writing to Firestore by removing any keys with `undefined` values.
 * Firestore throws a runtime exception if any field in an object or array is `undefined`.
 */
function cleanFirestoreData<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === undefined) {
        return undefined; // JSON.stringify omits keys with undefined values
      }
      return value;
    })
  );
}

/**
 * Saves or updates roster data to Firestore.
 */
export async function saveCloudRoster(
  data: Partial<CloudRosterState>
): Promise<void> {
  const docRef = doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID);
  const payload = cleanFirestoreData({
    ...data,
    updatedAt: new Date().toISOString()
  });
  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ROSTER_DOC_PATH}/${ROSTER_DOC_ID}`);
  }
}

/**
 * Overwrites entire cloud roster with fresh initial data.
 */
export async function resetCloudRoster(
  data: CloudRosterState
): Promise<void> {
  const docRef = doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID);
  const payload = cleanFirestoreData({
    ...data,
    updatedAt: new Date().toISOString()
  });
  try {
    await setDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ROSTER_DOC_PATH}/${ROSTER_DOC_ID}`);
  }
}
