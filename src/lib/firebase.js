import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, onSnapshot, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
// NOTE: firebase/storage and firebase/messaging are dynamically imported inside the
// functions that use them, so they stay out of the main bundle.

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
const provider    = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, provider);
export const logout          = () => signOut(auth);
export const onAuth          = (cb) => onAuthStateChanged(auth, cb);

export async function getOrCreateUser(user) {
  const ref  = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  const profile = {
    uid: user.uid, displayName: user.displayName, photoURL: user.photoURL,
    xp: 0, level: 1, streak: 0, longestStreak: 0,
    lastCheckIn: null, excuseActive: null,
    gymRecords: [], friends: [], weeklyPlan: null,
    planTasksDone: {},
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return profile;
}

export const getUserProfile    = async (uid) => { const s = await getDoc(doc(db,"users",uid)); return s.exists()?s.data():null; };
export const updateUserProfile = (uid, data) => updateDoc(doc(db,"users",uid), data);

export async function submitCheckIn(uid, habits, todayStr, habitCategories) {
  const profile = await getUserProfile(uid);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const yStr = yesterday.toISOString().split("T")[0];

  // Streak calc
  let newStreak = profile.streak || 0;
  const last = profile.lastCheckIn;
  if (!last)              newStreak = 1;
  else if (last===todayStr) newStreak = profile.streak; // already checked in
  else if (last===yStr)   newStreak = profile.streak + 1;
  else {
    const excuseCovers = profile.excuseActive && new Date(profile.excuseActive.until) >= yesterday;
    newStreak = excuseCovers ? profile.streak + 1 : 1;
  }

  // XP: use per-habit values from gameData, plus streak bonus
  let xpGained = 0;
  const allHabits = Object.values(habitCategories).flatMap(c => c.habits);
  allHabits.forEach(h => { if (habits[h.id]) xpGained += h.xp; });
  const streakBonus = newStreak >= 7 ? Math.min(Math.floor(newStreak / 7) * 10, 50) : 0;
  xpGained += streakBonus;

  const newXP    = (profile.xp||0) + xpGained;
  const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;
  const levelUp  = newLevel > (profile.level||1);

  await updateDoc(doc(db,"users",uid), {
    streak: newStreak,
    longestStreak: Math.max(newStreak, profile.longestStreak||0),
    lastCheckIn: todayStr,
    xp: newXP,
    level: newLevel,
  });
  await setDoc(doc(db,"users",uid,"checkins",todayStr), {
    habits, xpGained, streakBonus, streak: newStreak, timestamp: serverTimestamp(),
  });

  // Sync to any classes the user is in (so teachers see live progress)
  // Fire-and-forget — don't block the return on this
  syncMemberProgress(uid, { xp:newXP, streak:newStreak, lastCheckIn:todayStr }).catch(()=>{});

  return { xpGained, streakBonus, newStreak, newLevel, newXP, levelUp, prevLevel: profile.level||1 };
}

export const setExcuse   = async (uid, reason, days=1) => {
  const until = new Date(); until.setDate(until.getDate()+days);
  await updateDoc(doc(db,"users",uid), { excuseActive: { reason, until: until.toISOString().split("T")[0] } });
};
export const clearExcuse = (uid) => updateDoc(doc(db,"users",uid), { excuseActive: null });
// GymRecords now live in a subcollection (users/{uid}/gymRecords/{docId}) instead of
// an array on the user document. Arrays hit Firestore's 1MB doc limit with heavy use.
export const addGymRecord = (uid, record) =>
  setDoc(doc(collection(db, "users", uid, "gymRecords")), {
    ...record,
    createdAt: serverTimestamp(),
  });

export const getGymRecords = async (uid, limitN = 500) => {
  const q = query(
    collection(db, "users", uid, "gymRecords"),
    orderBy("createdAt", "desc"),
    limit(limitN)
  );
  const s = await getDocs(q);
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const deleteGymRecord = (uid, recordId) =>
  deleteDoc(doc(db, "users", uid, "gymRecords", recordId));
export const saveWeeklyPlan = (uid, plan) => updateDoc(doc(db,"users",uid), { weeklyPlan: plan, planTasksDone: {} });
export const togglePlanTask = (uid, key, current) => updateDoc(doc(db,"users",uid), { [`planTasksDone.${key}`]: !current });

export async function getLeaderboard(n=30) {
  const q = query(collection(db,"users"), orderBy("xp","desc"), limit(n));
  const s = await getDocs(q);
  return s.docs.map(d => d.data());
}

export async function getCheckinHistory(uid) {
  const q = query(collection(db,"users",uid,"checkins"), orderBy("timestamp","asc"));
  const s = await getDocs(q);
  return s.docs.map(d => ({ date: d.id, ...d.data() }));
}

// ── Real-time leaderboard ──────────────────────────────────────────────
export const watchLeaderboard = (n=30, cb) => {
  const q = query(collection(db,"users"), orderBy("xp","desc"), limit(n));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data())));
};

// ── Challenges (full accept/decline/outcome flow) ──────────────────────
export const sendChallenge = (fromUid, fromName, toUid, toName, type, days=7) => {
  const ends = new Date(); ends.setDate(ends.getDate()+days);
  return setDoc(doc(db,"challenges",`${fromUid}_${toUid}_${Date.now()}`), {
    from:fromUid, fromName, to:toUid, toName, type, days,
    participants: [fromUid, toUid],
    status:"pending",
    fromStartXP:null, toStartXP:null,
    endsAt: ends.toISOString().split("T")[0],
    createdAt: serverTimestamp(),
  });
};

export const watchMyChallenges = (uid, cb) => {
  // Challenges where I'm involved (either side)
  const q = query(collection(db,"challenges"), where("participants","array-contains",uid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
};

// Fallback fetch (challenges use participants array for querying)
export const getMyChallenges = async (uid) => {
  const q = query(collection(db,"challenges"), where("participants","array-contains",uid));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id:d.id, ...d.data() }));
};

export const acceptChallenge = async (challengeId) => {
  const ref  = doc(db,"challenges",challengeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const c = snap.data();
  const [fromP, toP] = await Promise.all([getUserProfile(c.from), getUserProfile(c.to)]);
  await updateDoc(ref, {
    status:"active",
    fromStartXP: fromP?.xp || 0,
    toStartXP:   toP?.xp   || 0,
    acceptedAt:  serverTimestamp(),
  });
};

export const declineChallenge = (challengeId) =>
  updateDoc(doc(db,"challenges",challengeId), { status:"declined" });

// Resolve a finished challenge — compute winner from XP gained
export const resolveChallenge = async (challengeId) => {
  const ref  = doc(db,"challenges",challengeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const c = snap.data();
  if (c.status !== "active") return c;
  const [fromP, toP] = await Promise.all([getUserProfile(c.from), getUserProfile(c.to)]);
  const fromGain = (fromP?.xp||0) - (c.fromStartXP||0);
  const toGain   = (toP?.xp||0)   - (c.toStartXP||0);
  const winner   = fromGain === toGain ? "tie" : fromGain > toGain ? c.from : c.to;
  await updateDoc(ref, { status:"completed", fromGain, toGain, winner, resolvedAt:serverTimestamp() });
  return { ...c, fromGain, toGain, winner, status:"completed" };
};

// ── Profile photo upload (Firebase Storage) ────────────────────────────
export const uploadProfilePhoto = async (uid, file) => {
  const { getStorage, ref: storageRef, uploadBytes, getDownloadURL } = await import("firebase/storage");
  const storage = getStorage(app);
  const ref  = storageRef(storage, `profilePhotos/${uid}/${Date.now()}_${file.name}`);
  await uploadBytes(ref, file);
  const url  = await getDownloadURL(ref);
  await updateDoc(doc(db,"users",uid), { customPhotoURL: url });
  return url;
};

// ── Persist AI results (nutrition + scans) ─────────────────────────────
export const saveNutritionEntry = (uid, entry) =>
  setDoc(doc(collection(db,"users",uid,"nutrition")), { ...entry, timestamp:serverTimestamp() });

export const getNutritionLog = async (uid, dateStr) => {
  const q = query(collection(db,"users",uid,"nutrition"), orderBy("timestamp","desc"), limit(50));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id:d.id, ...d.data() })).filter(e => !dateStr || e.date===dateStr);
};

export const saveScanResult = (uid, scanType, result) =>
  setDoc(doc(collection(db,"users",uid,"scans")), { scanType, result, timestamp:serverTimestamp() });

export const getScanHistory = async (uid, scanType) => {
  const q = query(collection(db,"users",uid,"scans"), orderBy("timestamp","desc"), limit(20));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id:d.id, ...d.data() })).filter(e => !scanType || e.scanType===scanType);
};

// ── Skills ──────────────────────────────────────────────────────────────
export const getSkills = async (uid) => {
  const q = query(collection(db,"users",uid,"skills"), orderBy("createdAt","desc"));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id:d.id, ...d.data() }));
};

export const createSkill = (uid, skill) =>
  setDoc(doc(collection(db,"users",uid,"skills")), { ...skill, xp:0, level:1, totalMinutes:0, sessions:0, createdAt:serverTimestamp() });

export const logSkillSession = async (uid, skillId, session) => {
  const ref  = doc(db,"users",uid,"skills",skillId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d     = snap.data();
  const newMin = (d.totalMinutes||0) + (session.duration||0);
  const newSess = (d.sessions||0) + 1;
  const newXP  = (d.xp||0) + Math.round((session.duration||30) / 10) * (session.rating||3);
  const newLvl = Math.floor(Math.sqrt(newXP / 50)) + 1;
  await updateDoc(ref, { totalMinutes:newMin, sessions:newSess, xp:newXP, level:newLvl, lastPracticed:session.date });
  await setDoc(doc(db,"users",uid,"skills",skillId,"sessions",`${Date.now()}`), { ...session, timestamp:serverTimestamp() });
};

export const getSkillSessions = async (uid, skillId) => {
  const q = query(collection(db,"users",uid,"skills",skillId,"sessions"), orderBy("timestamp","desc"), limit(30));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id:d.id, ...d.data() }));
};

export const deleteSkill = (uid, skillId) =>
  deleteDoc(doc(db,"users",uid,"skills",skillId));

// ── Friends / QR ────────────────────────────────────────────────────────
export const sendFriendRequest = async (fromUid, toUid) => {
  if (fromUid === toUid) throw new Error("Can't add yourself");
  await setDoc(doc(db,"friendRequests",`${fromUid}_${toUid}`), {
    from:fromUid, to:toUid, status:"pending", createdAt:serverTimestamp()
  });
};

export const acceptFriendRequest = async (reqId, myUid, theirUid) => {
  await updateDoc(doc(db,"friendRequests",reqId), { status:"accepted" });
  await updateDoc(doc(db,"users",myUid),   { friends: arrayUnion(theirUid) });
  await updateDoc(doc(db,"users",theirUid),{ friends: arrayUnion(myUid)   });
};

export const declineFriendRequest = (reqId) =>
  updateDoc(doc(db,"friendRequests",reqId), { status:"declined" });

export const getIncomingRequests = async (uid) => {
  const q = query(collection(db,"friendRequests"), where("to","==",uid), where("status","==","pending"));
  const s = await getDocs(q);
  return s.docs.map(d => ({ id:d.id, ...d.data() }));
};

// Real-time listener for incoming friend requests
export const watchIncomingRequests = (uid, cb) => {
  const q = query(collection(db,"friendRequests"), where("to","==",uid), where("status","==","pending"));
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id:d.id, ...d.data() }))));
};

export const getFriendsProfiles = async (friendUids) => {
  if (!friendUids?.length) return [];
  return Promise.all(friendUids.map(uid => getUserProfile(uid)));
};

// ── Public profile ───────────────────────────────────────────────────────
export const getPublicProfile = async (uid) => {
  const profile  = await getUserProfile(uid);
  if (!profile) return null;
  const skillsSnap = await getDocs(collection(db,"users",uid,"skills"));
  const skills = skillsSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  return { ...profile, skills };
};

// ── Push notifications (FCM) ────────────────────────────────────────────
// Requires VITE_FIREBASE_VAPID_KEY in .env (Firebase Console → Cloud Messaging → Web Push certificates)
export async function enablePushNotifications(uid, reminderHour) {
  const { getMessaging, getToken, onMessage, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("Push not supported in this browser");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied");

  const messaging = getMessaging(app);
  const vapidKey  = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  const token     = await getToken(messaging, { vapidKey });
  if (!token) throw new Error("Could not get FCM token");

  await updateDoc(doc(db,"users",uid), {
    fcmToken: token,
    reminderEnabled: true,
    reminderHour: reminderHour ?? 21,
  });

  onMessage(messaging, payload => {
    new Notification(payload.notification?.title || "GRIND", {
      body: payload.notification?.body, icon: "/icon-192.png",
    });
  });

  return token;
}

export const updateReminderPrefs = (uid, enabled, hour) =>
  updateDoc(doc(db,"users",uid), { reminderEnabled: enabled, reminderHour: hour });

// ── Onboarding profile ──────────────────────────────────────────────────
// Stored at users/{uid}/private/onboarding so it can be locked down separately
export const saveOnboarding = (uid, data) =>
  setDoc(doc(db, "users", uid, "private", "onboarding"), {
    ...data,
    completedAt: serverTimestamp(),
    version: 1,
  });

export const getUserOnboarding = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid, "private", "onboarding"));
  return snap.exists() ? snap.data() : null;
};

export const hasCompletedOnboarding = async (uid) => {
  const o = await getUserOnboarding(uid);
  return !!o?.completedAt;
};

export const updateOnboarding = (uid, patch) =>
  updateDoc(doc(db, "users", uid, "private", "onboarding"), patch);

// ── Classes / Teacher-Coach System ────────────────────────────────────
// Data model:
//   classes/{classId}: { name, description, teacherUid, teacherName, joinCode, type, createdAt, memberCount }
//   classes/{classId}/members/{uid}: { uid, displayName, photoURL, joinedAt, currentXP, currentStreak, lastCheckIn }
//   users/{uid}.classes: [{ classId, role: 'teacher'|'student', joinedAt }]
//   users/{uid}.role: 'teacher' | 'student' (default 'student')

function genJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 ambiguity
  // Use crypto.getRandomValues instead of Math.random (not cryptographically safe)
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % chars.length]).join("");
}

export const setUserRole = (uid, role) =>
  updateDoc(doc(db,"users",uid), { role });

export const createClass = async (teacherUid, teacherName, { name, description, type }) => {
  const joinCode = genJoinCode();
  const classRef = doc(collection(db, "classes"));
  await setDoc(classRef, {
    name, description: description||"", type: type||"general",
    teacherUid, teacherName, joinCode,
    memberCount: 0, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db,"users",teacherUid), {
    role: "teacher",
    teachingClasses: arrayUnion(classRef.id),
  });
  return { id: classRef.id, joinCode, name };
};

export const joinClassByCode = async (uid, displayName, photoURL, code) => {
  // Find class by code
  const q = query(collection(db,"classes"), where("joinCode","==",code.toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Class not found. Check the code.");
  const classDoc = snap.docs[0];
  const classData = classDoc.data();

  // Guard: don't double-add — memberCount would become wrong
  const memberRef = doc(db,"classes",classDoc.id,"members",uid);
  const memberSnap = await getDoc(memberRef);
  if (memberSnap.exists()) {
    // Already a member — just make sure user doc is in sync
    await updateDoc(doc(db,"users",uid), { studentClasses: arrayUnion(classDoc.id) });
    return { id: classDoc.id, name: classData.name, teacherName: classData.teacherName };
  }

  // Add member doc
  await setDoc(memberRef, {
    uid, displayName, photoURL: photoURL||null,
    joinedAt: serverTimestamp(),
    currentXP: 0, currentStreak: 0, lastCheckIn: null,
  });

  // Bump count + record on user
  await updateDoc(doc(db,"classes",classDoc.id), { memberCount: (classData.memberCount||0)+1 });
  await updateDoc(doc(db,"users",uid), { studentClasses: arrayUnion(classDoc.id) });

  return { id: classDoc.id, name: classData.name, teacherName: classData.teacherName };
};

export const leaveClass = async (uid, classId) => {
  await deleteDoc(doc(db,"classes",classId,"members",uid));
  await updateDoc(doc(db,"users",uid), { studentClasses: arrayRemove(classId) });
  const cls = await getDoc(doc(db,"classes",classId));
  if (cls.exists()) {
    await updateDoc(doc(db,"classes",classId), { memberCount: Math.max(0, (cls.data().memberCount||1)-1) });
  }
};

export const getClass = async (classId) => {
  const snap = await getDoc(doc(db,"classes",classId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const watchClassMembers = (classId, cb) => {
  const q = query(collection(db,"classes",classId,"members"), orderBy("currentXP","desc"));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data())));
};

export const getMyClasses = async (uid) => {
  const userSnap = await getDoc(doc(db,"users",uid));
  if (!userSnap.exists()) return { teaching: [], student: [] };
  const u = userSnap.data();
  const teachingIds = u.teachingClasses || [];
  const studentIds  = u.studentClasses  || [];
  const [teaching, student] = await Promise.all([
    Promise.all(teachingIds.map(id => getClass(id))),
    Promise.all(studentIds.map(id => getClass(id))),
  ]);
  return {
    teaching: teaching.filter(Boolean),
    student:  student.filter(Boolean),
  };
};

export const regenerateJoinCode = async (classId) => {
  const newCode = genJoinCode();
  await updateDoc(doc(db,"classes",classId), { joinCode: newCode });
  return newCode;
};

export const deleteClass = async (classId, teacherUid) => {
  // Remove from teacher's list
  await updateDoc(doc(db,"users",teacherUid), { teachingClasses: arrayRemove(classId) });
  // Delete the class doc (members subcollection will become orphaned but Firebase doesn't
  // recursively delete — for a real prod app, do this with a Cloud Function)
  await deleteDoc(doc(db,"classes",classId));
};

// Sync member's progress (called after every check-in so teachers see live data)
export async function syncMemberProgress(uid, profile) {
  const userSnap = await getDoc(doc(db,"users",uid));
  if (!userSnap.exists()) return;
  const u = userSnap.data();
  const classes = u.studentClasses || [];
  await Promise.all(classes.map(classId =>
    updateDoc(doc(db,"classes",classId,"members",uid), {
      currentXP: profile.xp || 0,
      currentStreak: profile.streak || 0,
      lastCheckIn: profile.lastCheckIn || null,
    }).catch(()=>{}) // member doc may not exist if they left
  ));
}
